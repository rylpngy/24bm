package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.AdditionalAnswers.delegatesTo;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.api.*;
import com.procurement.identity.application.*;
import com.procurement.identity.domain.BuyerUserStatusTransition;
import com.procurement.identity.infrastructure.*;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.organization.application.DepartmentApplicationService;
import com.procurement.organization.api.UpdateDepartmentRequest;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.tenant.application.TenantEntitlementApplicationService;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.apache.ibatis.session.SqlSessionFactory;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// Only a disposable container is used; service proxies execute the real transaction annotations.
@Testcontainers
class BuyerAdminIntegrityPostgresIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  static DriverManagerDataSource source;
  static JdbcTemplate jdbc;
  BuyerUserApplicationService users;
  BuyerRoleApplicationService roles;
  BuyerUserMapper userMapper;
  PermissionService permissions;
  DataScopeService scopes;
  DepartmentMapper departmentMapper;
  DataSourceTransactionManager transactions;
  String tenant, first, second, department, otherDepartment, role1, role2, reader, rejected;
  final ObjectMapper json = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  @BeforeAll static void schema() {
    source = new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    jdbc = new JdbcTemplate(source);
    jdbc.execute("""
        create table tenants(id text primary key);
        create table users(id text primary key,tenant_id text,supplier_id text,name text,mobile text,email text,
          status text,department_id text,password_hash text,employee_no text,job_title text,
          created_at timestamptz default now(),updated_at timestamptz default now());
        create table departments(id text primary key,tenant_id text,parent_id text,status text,manager_id text,
          name text default 'Department',description text default '',established_on date default current_date,
          created_at timestamptz default now(),updated_at timestamptz default now());
        create table roles(id text primary key,tenant_id text,supplier_id text,scope text,name text,
          permissions jsonb,data_scope text);
        create table user_roles(user_id text references users(id),role_id text references roles(id),
          primary key(user_id,role_id),check(role_id not like '%-reject'));
        """);
  }

  @BeforeEach void setup() throws Exception {
    tenant = UUID.randomUUID().toString(); first = tenant + "-u1"; second = tenant + "-u2";
    department = tenant + "-d1"; otherDepartment = tenant + "-d2";
    role1 = tenant + "-r1"; role2 = tenant + "-r2"; reader = tenant + "-reader"; rejected = tenant + "-reject";
    jdbc.update("insert into tenants values (?)", tenant);
    for (String d : List.of(department, otherDepartment))
      jdbc.update("insert into departments(id,tenant_id,status) values (?,?,'active')", d, tenant);
    for (String r : List.of(role1, role2, reader, rejected))
      jdbc.update("insert into roles values (?,?,null,'buyer',?,?::jsonb,'all')", r, tenant, r,
          List.of(role1, role2).contains(r) ? "[\"buyer:role:manage\"]" : "[\"buyer:demand:read\"]");
    for (String u : List.of(first, second))
      jdbc.update("insert into users(id,tenant_id,name,status,department_id) values (?,?,?,'active',?)", u, tenant, u, department);
    jdbc.update("insert into user_roles values (?,?),(?,?)", first, role1, second, role2);
    var configuration = new org.apache.ibatis.session.Configuration();
    configuration.setMapUnderscoreToCamelCase(true);
    for (Class<?> mapper : List.of(BuyerUserMapper.class, BuyerRoleMapper.class, DepartmentMapper.class,
        PermissionMapper.class, DataScopeMapper.class)) configuration.addMapper(mapper);
    var factory = new SqlSessionFactoryBean();
    factory.setDataSource(source); factory.setConfiguration(configuration);
    SqlSessionFactory sessions = factory.getObject();
    var sql = new SqlSessionTemplate(sessions);
    transactions = new DataSourceTransactionManager(source);
    departmentMapper = sql.getMapper(DepartmentMapper.class);
    userMapper = sql.getMapper(BuyerUserMapper.class);
    permissions = new PermissionService(sql.getMapper(PermissionMapper.class));
    scopes = new DataScopeService(sql.getMapper(DataScopeMapper.class));
    users = transactional(new BuyerUserApplicationService(userMapper, sql.getMapper(DepartmentMapper.class),
        mock(TenantEntitlementApplicationService.class), mock(AuditLogApplicationService.class),
        mock(PasswordEncoder.class), new BuyerUserStatusTransition(), permissions), transactions);
    roles = transactional(new BuyerRoleApplicationService(sql.getMapper(BuyerRoleMapper.class), permissions,
        mock(ApplicationEventPublisher.class)), transactions);
    TenantContext.set(tenant, null, first);
  }

  @SuppressWarnings("unchecked")
  private <T> T transactional(T target, DataSourceTransactionManager transactions) {
    var proxy = new ProxyFactory(target);
    proxy.setProxyTargetClass(true);
    proxy.addAdvice(new TransactionInterceptor(transactions, new AnnotationTransactionAttributeSource()));
    return (T) proxy.getProxy();
  }

  @AfterEach void clear() { TenantContext.clear(); }

  @ParameterizedTest
  @ValueSource(strings = {"disable", "single", "multi", "profile", "permissions", "details"})
  void everyWritePathRejectsRemovingTheLastFullAdministratorAndRollsBack(String operation) throws Exception {
    jdbc.update("update users set status='inactive' where id=?", second);
    assertThatThrownBy(() -> remove(operation, first, role1)).isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("管理员");
    assertThat(activeAdmins()).isEqualTo(1);
    assertThat(userMapper.findByTenantAndId(tenant, first).name()).isEqualTo(first);
  }

  @ParameterizedTest
  @CsvSource({"disable,disable", "disable,multi", "profile,permissions", "details,single"})
  void concurrentUserAndRoleMutationsCannotBothRemoveAdministrators(String a, String b) throws Exception {
    var ready = new CyclicBarrier(2);
    try (var pool = Executors.newFixedThreadPool(2)) {
      Future<Boolean> one = pool.submit(() -> attempt(a, first, role1, ready));
      Future<Boolean> two = pool.submit(() -> attempt(b, second, role2, ready));
      assertThat(List.of(one.get(20, TimeUnit.SECONDS), two.get(20, TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(true, false);
    }
    assertThat(activeAdmins()).isEqualTo(1);
  }

  private boolean attempt(String operation, String user, String role, CyclicBarrier barrier) throws Exception {
    TenantContext.set(tenant, null, user);
    try {
      barrier.await(10, TimeUnit.SECONDS);
      remove(operation, user, role);
      return true;
    } catch (IllegalStateException denied) {
      assertThat(denied).hasMessageContaining("管理员");
      return false;
    } finally { TenantContext.clear(); }
  }

  private void remove(String operation, String user, String role) throws Exception {
    switch (operation) {
      case "disable" -> users.changeUserStatus(user, new ChangeBuyerUserStatusRequest("inactive"));
      case "single" -> users.changeUserRole(user, new ChangeBuyerUserRoleRequest(reader));
      case "multi" -> users.updateUserRoles(user, new UpdateBuyerUserRolesRequest(List.of(reader)));
      case "profile" -> users.updateUser(user, new UpdateBuyerUserRequest("Edited", null, null, otherDepartment, reader, null, null));
      case "permissions" -> roles.updateRolePermissions(role, new UpdateRolePermissionsRequest(List.of("buyer:demand:read")));
      case "details" -> roles.updateRole(role, new UpdateBuyerRoleRequest("Edited role", List.of("buyer:demand:read"), "self"));
      default -> throw new AssertionError(operation);
    }
  }

  @Test void disabledMembersKeepAssignmentsButNeverEffectivePermissionsOrScope() {
    users.updateUserRoles(second, new UpdateBuyerUserRolesRequest(List.of(role2, reader)));
    users.changeUserStatus(second, new ChangeBuyerUserStatusRequest("inactive"));
    var member = users.listCurrentTenantUsers("inactive", null, null).getFirst();
    assertThat(member.roleIds()).containsExactlyInAnyOrder(role2, reader);
    assertThat(permissions.userHas(second, "buyer:role:manage")).isFalse();
    assertThat(scopes.userDataScope(tenant, second).blocksAll()).isTrue();
  }

  @Test void editingAndReenablingInactiveMemberRetainsAllAssignments() throws Exception {
    users.changeUserStatus(second, new ChangeBuyerUserStatusRequest("inactive"));
    var updated = users.updateUser(second, json.readValue("""
        {"name":"Edited inactive","departmentId":"%s","roleIds":["%s","%s"]}
        """.formatted(department, role2, reader), UpdateBuyerUserRequest.class));
    assertThat(updated.roleIds()).containsExactlyInAnyOrder(role2, reader);
    assertThat(updated.status()).isEqualTo("inactive");
    assertThat(permissions.userHas(second, "buyer:role:manage")).isFalse();
    var active = users.changeUserStatus(second, new ChangeBuyerUserStatusRequest("active"));
    assertThat(active.roleIds()).containsExactlyInAnyOrder(role2, reader);
    assertThat(permissions.userHas(second, "buyer:role:manage")).isTrue();
  }

  @ParameterizedTest
  @ValueSource(strings = {"buyer:*", "buyer:role:*", "buyer:role:manage"})
  void allEffectiveFullAdministrationGrantsAreProtected(String permission) {
    jdbc.update("update users set status='inactive' where id=?", second);
    jdbc.update("update roles set permissions=?::jsonb where id=?", "[\"" + permission + "\"]", role1);
    assertThatThrownBy(() -> users.changeUserStatus(first, new ChangeBuyerUserStatusRequest("inactive")))
        .isInstanceOf(IllegalStateException.class).hasMessageContaining("管理员");
    assertThat(userMapper.findByTenantAndId(tenant, first).status()).isEqualTo("active");
  }

  @Test void normalBusinessMemberCannotConfigureRolesMembersOrDataScopes() {
    jdbc.update("update roles set permissions='[\"buyer:demand:read\"]' where id=?", role2);
    TenantContext.set(tenant, null, second);
    assertThatThrownBy(() -> roles.updateRoleDataScope(role2, new UpdateRoleDataScopeRequest("all")))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    assertThatThrownBy(() -> users.updateUserRoles(second, new UpdateBuyerUserRolesRequest(List.of(role1))))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    assertThatThrownBy(() -> users.changeUserStatus(first, new ChangeBuyerUserStatusRequest("inactive")))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
  }

  @Test void scopeUpdatesAndDepartmentMovesChangeEffectiveScopeWithoutRelogin() {
    roles.updateRoleDataScope(role2, new UpdateRoleDataScopeRequest("self"));
    assertThat(scopes.userDataScope(tenant, second).requesterId()).isEqualTo(second);
    roles.updateRoleDataScope(role2, new UpdateRoleDataScopeRequest("department"));
    assertThat(scopes.userDataScope(tenant, second).departmentIds()).containsExactly(department);
    users.updateUser(second, new UpdateBuyerUserRequest(second, null, null, otherDepartment, role2, null, null));
    assertThat(scopes.userDataScope(tenant, second).departmentIds()).containsExactly(otherDepartment);
    jdbc.update("update departments set parent_id=? where id=?", department, otherDepartment);
    users.updateUser(second, new UpdateBuyerUserRequest(second, null, null, department, role2, null, null));
    roles.updateRoleDataScope(role2, new UpdateRoleDataScopeRequest("department_and_below"));
    assertThat(scopes.userDataScope(tenant, second).departmentIds()).containsExactlyInAnyOrder(department, otherDepartment);
    roles.updateRoleDataScope(role2, new UpdateRoleDataScopeRequest("all"));
    assertThat(scopes.userDataScope(tenant, second).restricted()).isFalse();
  }

  @Test void createAndUpdateAcceptRoleIdsWithoutLegacyRoleIdAndPersistBoth() throws Exception {
    var created = users.createUser(json.readValue("""
        {"name":"Created","status":"active","departmentId":"%s","initialPassword":"secret123",
         "roleIds":["%s","%s"]}
        """.formatted(department, reader, role2), CreateBuyerUserRequest.class));
    assertThat(created.roleIds()).containsExactlyInAnyOrder(reader, role2);
    var updated = users.updateUser(created.id(), json.readValue("""
        {"name":"Edited","departmentId":"%s","roleIds":["%s","%s"]}
        """.formatted(otherDepartment, role1, reader), UpdateBuyerUserRequest.class));
    assertThat(updated.roleIds()).containsExactlyInAnyOrder(role1, reader);
    assertThat(updated.departmentId()).isEqualTo(otherDepartment);
  }

  @ParameterizedTest
  @ValueSource(strings = {"active", "inactive"})
  void legacyRoleIdCreationAcceptsBothSupportedStatusesWithoutActivatingInactiveGrants(String status) {
    var created = users.createUser(new CreateBuyerUserRequest(
        "Legacy member", null, null, status, department, role1, "secret123"));
    assertThat(created.status()).isEqualTo(status);
    assertThat(created.roleIds()).containsExactly(role1);
    assertThat(permissions.userHas(created.id(), "buyer:role:manage")).isEqualTo("active".equals(status));
  }

  @Test void databaseAssignmentFailureRollsBackCreatedMember() throws Exception {
    var request = json.readValue("""
        {"name":"Atomic create","status":"active","departmentId":"%s","roleId":"%s",
         "roleIds":["%s","%s"],"initialPassword":"secret123"}
        """.formatted(department, reader, reader, rejected), CreateBuyerUserRequest.class);
    assertThatThrownBy(() -> users.createUser(request)).isInstanceOf(RuntimeException.class);
    assertThat(jdbc.queryForObject("select count(*) from users where tenant_id=?", Integer.class, tenant)).isEqualTo(2);
  }

  @Test void databaseAssignmentFailureRollsBackProfileRolesAndManagerCleanup() throws Exception {
    jdbc.update("update departments set manager_id=? where id=?", second, department);
    var request = json.readValue("""
        {"name":"Atomic edit","departmentId":"%s","roleId":"%s","roleIds":["%s","%s"]}
        """.formatted(otherDepartment, reader, reader, rejected), UpdateBuyerUserRequest.class);
    assertThatThrownBy(() -> users.updateUser(second, request)).isInstanceOf(RuntimeException.class);
    assertThat(userMapper.findByTenantAndId(tenant, second).name()).isEqualTo(second);
    assertThat(userMapper.listBuyerRoleIdsByTenantAndUser(tenant, second)).containsExactly(role2);
    assertThat(jdbc.queryForObject("select manager_id from departments where id=?", String.class, department)).isEqualTo(second);
  }

  @Test void managerMoveAndDisableRetainExistingCleanupBehavior() {
    jdbc.update("update departments set manager_id=? where id=?", second, department);
    users.updateUser(second, new UpdateBuyerUserRequest(second, null, null, otherDepartment, role2, null, null));
    assertThat(jdbc.queryForObject("select manager_id from departments where id=?", String.class, department)).isNull();
    jdbc.update("update departments set manager_id=? where id=?", second, otherDepartment);
    users.changeUserStatus(second, new ChangeBuyerUserStatusRequest("inactive"));
    assertThat(jdbc.queryForObject("select manager_id from departments where id=?", String.class, otherDepartment)).isNull();
  }

  @ParameterizedTest
  @CsvSource({"false,disable", "false,move", "true,disable", "true,move"})
  void managerAppointmentAndTransferSerializeWithMemberDisableAndMove(boolean transfer, String action) throws Exception {
    String target = transfer ? otherDepartment : department;
    String movedTo = transfer ? department : otherDepartment;
    var validated = new CountDownLatch(1);
    var resumeAppointment = new CountDownLatch(1);
    var mutationAttempted = new CountDownLatch(1);
    var appointmentUsers = mock(BuyerUserMapper.class, delegatesTo(userMapper));
    var appointmentDepartments = mock(DepartmentMapper.class, delegatesTo(departmentMapper));
    if (transfer) {
      // Pause after reading the manager, before the transfer writes acquire any user-row lock.
      doAnswer(call -> {
        var manager = userMapper.findByTenantAndId(tenant, second);
        validated.countDown();
        awaitAppointmentRelease(resumeAppointment);
        return manager;
      }).when(appointmentUsers).findByTenantAndId(tenant, second);
    } else {
      // Pause after the last active-member check and before the manager is written back.
      doAnswer(call -> {
        boolean active = departmentMapper.existsActiveMemberByTenantAndDepartment(tenant, target, second);
        validated.countDown();
        awaitAppointmentRelease(resumeAppointment);
        return active;
      }).when(appointmentDepartments).existsActiveMemberByTenantAndDepartment(tenant, target, second);
    }
    var departments = transactional(new DepartmentApplicationService(appointmentDepartments,
        mock(PurchaseDemandMapper.class), mock(AuditLogApplicationService.class), appointmentUsers, permissions), transactions);
    var mutationUsers = mock(BuyerUserMapper.class, delegatesTo(userMapper));
    doAnswer(call -> {
      mutationAttempted.countDown();
      return userMapper.lockAdministrationTenant(tenant);
    }).when(mutationUsers).lockAdministrationTenant(tenant);
    var lifecycle = transactional(new BuyerUserApplicationService(mutationUsers, departmentMapper,
        mock(TenantEntitlementApplicationService.class), mock(AuditLogApplicationService.class),
        mock(PasswordEncoder.class), new BuyerUserStatusTransition(), permissions), transactions);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var appoint = pool.submit(() -> {
        TenantContext.set(tenant, null, first);
        try { return departments.updateDepartment(target, new UpdateDepartmentRequest("Department", "", second, transfer)); }
        finally { TenantContext.clear(); }
      });
      try {
        assertThat(validated.await(15, TimeUnit.SECONDS)).isTrue();
        var mutate = pool.submit(() -> {
          TenantContext.set(tenant, null, first);
          try {
            return "disable".equals(action)
                ? lifecycle.changeUserStatus(second, new ChangeBuyerUserStatusRequest("inactive"))
                : lifecycle.updateUser(second, new UpdateBuyerUserRequest(second, null, null, movedTo, role2, null, null));
          } finally { TenantContext.clear(); }
        });
        try {
          assertThat(mutationAttempted.await(15, TimeUnit.SECONDS)).isTrue();
          assertThatThrownBy(() -> mutate.get(1, TimeUnit.SECONDS)).isInstanceOf(TimeoutException.class);
        } finally { resumeAppointment.countDown(); }
        appoint.get(15, TimeUnit.SECONDS);
        var member = mutate.get(15, TimeUnit.SECONDS);
        assertThat(jdbc.queryForObject("select manager_id from departments where id=?", String.class, target)).isNull();
        if ("disable".equals(action)) assertThat(member.status()).isEqualTo("inactive");
        else assertThat(member.departmentId()).isEqualTo(movedTo);
      } finally { resumeAppointment.countDown(); }
    }
  }

  private static void awaitAppointmentRelease(CountDownLatch release) throws InterruptedException {
    if (!release.await(20, TimeUnit.SECONDS)) throw new IllegalStateException("Appointment test did not release its checkpoint");
  }

  private int activeAdmins() {
    return jdbc.queryForObject("""
        select count(distinct u.id) from users u join user_roles ur on ur.user_id=u.id
        join roles r on r.id=ur.role_id and r.tenant_id=u.tenant_id and r.scope='buyer'
        where u.tenant_id=? and u.status='active'
          and (r.permissions @> '["buyer:*"]' or r.permissions @> '["buyer:role:manage"]')
        """, Integer.class, tenant);
  }
}
