package com.procurement;

import static org.assertj.core.api.Assertions.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.application.SupplierTeamRoleService;
import com.procurement.supplier.api.SupplierTeamRoleModels.*;
import java.util.List;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest @Testcontainers @org.springframework.test.annotation.DirtiesContext
class SupplierTeamRoleIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl);
    r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword);
    r.add("keycloak.enabled", () -> false); r.add("app.seed.locations", () -> "");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired SupplierTeamRoleService service;
  @Autowired PermissionService permissions;
  @BeforeEach void seed() {
    jdbc.update("insert into enterprises(id,name,type) values ('sra','A','supplier'),('srb','B','supplier') on conflict do nothing");
    jdbc.update("insert into users(id,supplier_id,name,status) values ('sra-owner','sra','Owner A','active'),('sra-member','sra','Member A','active'),('srb-owner','srb','Owner B','active') on conflict do nothing");
    jdbc.update("insert into user_roles(user_id,role_id) values ('sra-owner','role-system-supplier-owner'),('srb-owner','role-system-supplier-owner') on conflict do nothing");
    TenantContext.set(null,"sra","sra-owner");
  }
  @AfterEach void clear() {TenantContext.clear();}
  @Test void rolesAreScopedAndMultipleGrantsAreAuditedAndInvalidateSessions() {
    var read=service.create(new Save("Order reader",List.of("supplier:order:read")));
    var invoice=service.create(new Save("Invoice reader",List.of("supplier:invoice:read")));
    long before=jdbc.queryForObject("select session_version from users where id='sra-member'",Long.class);
    service.assign("sra-member",new Assign(List.of(read.id(),invoice.id())));
    assertThat(permissions.userHas("sra-member","supplier:order:read")).isTrue();
    assertThat(permissions.userHas("sra-member","supplier:invoice:read")).isTrue();
    assertThat(permissions.userHas("sra-member","supplier:order:manage")).isFalse();
    assertThat(jdbc.queryForObject("select session_version from users where id='sra-member'",Long.class)).isGreaterThan(before);
    long assignedVersion=jdbc.queryForObject("select session_version from users where id='sra-member'",Long.class);
    service.update(read.id(),new Save("Order operator",List.of("supplier:order:read","supplier:order:manage")));
    assertThat(jdbc.queryForObject("select session_version from users where id='sra-member'",Long.class)).isGreaterThan(assignedVersion);
    assertThat(permissions.userHas("sra-member","supplier:order:manage")).isTrue();
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where target_id=?",Integer.class,read.id())).isEqualTo(2);
    TenantContext.set(null,"srb","srb-owner");
    jdbc.update("insert into users(id,supplier_id,name,status) values ('srb-member','srb','Member B','active') on conflict do nothing");
    assertThat(service.list().roles()).noneMatch(r->r.id().equals(read.id()));
    assertThatThrownBy(()->service.assign("srb-member",new Assign(List.of(read.id())))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->service.update(read.id(),new Save("Foreign",List.of("supplier:order:read")))).isInstanceOf(IllegalArgumentException.class);
    // A corrupted cross-enterprise link must not grant permissions through the shared resolver.
    jdbc.update("insert into user_roles(user_id,role_id) values ('srb-owner',?)",read.id());
    jdbc.update("delete from user_roles where user_id='srb-owner' and role_id='role-system-supplier-owner'");
    assertThat(permissions.userHas("srb-owner","supplier:order:read")).isFalse();
  }
  @Test void invalidGrantsAndSelfChangesAreRejected() {
    assertThatThrownBy(()->service.create(new Save("Escalation",List.of("supplier:*")))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->service.create(new Save("Foreign permission",List.of("buyer:*")))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->service.update("role-system-supplier-member",new Save("System",List.of("supplier:order:read")))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->service.assign("sra-owner",new Assign(List.of("role-system-supplier-member")))).isInstanceOf(IllegalArgumentException.class);
    TenantContext.set(null,"sra","sra-member");
    assertThatThrownBy(()->service.list()).isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
  }
  @Test void namesAndReplacementAreControlled() {
    var role=service.create(new Save("Unique role",List.of("supplier:order:manage")));
    assertThat(role.permissions()).contains("supplier:order:read");
    assertThatThrownBy(()->service.create(new Save(" unique ROLE ",List.of("supplier:order:read")))).isInstanceOf(IllegalArgumentException.class);
    service.assign("sra-member",new Assign(List.of("role-system-supplier-member")));
    service.assign("sra-member",new Assign(List.of(role.id())));
    assertThat(permissions.userHas("sra-member","supplier:invoice:manage")).isFalse();
    assertThatThrownBy(()->service.assign("srb-owner",new Assign(List.of(role.id())))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->service.assign("sra-member",new Assign(List.of()))).isInstanceOf(IllegalArgumentException.class);
  }
}
