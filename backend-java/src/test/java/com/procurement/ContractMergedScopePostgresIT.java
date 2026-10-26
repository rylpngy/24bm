package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.contract.api.CreateContractRequest;
import com.procurement.contract.api.UpdateContractRequest;
import com.procurement.contract.application.ContractAccessService;
import com.procurement.contract.application.ContractApplicationService;
import com.procurement.contract.application.ContractAttachmentAccess;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.infrastructure.DataScopeMapper;
import com.procurement.identity.infrastructure.PermissionMapper;
import com.procurement.order.infrastructure.OrderAccessMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.util.Map;
import java.util.Set;
import org.apache.ibatis.datasource.pooled.PooledDataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.*;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// Executes real role resolution, recursive department SQL and contract mapper SQL. No permission mocks.
@Testcontainers
class ContractMergedScopePostgresIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  SqlSession session;
  ContractMapper contracts;
  ContractAccessService access;
  ContractAttachmentAccess attachments;
  ContractApplicationService service;
  DataScopeService scopes;

  private static final Map<String, Set<String>> VISIBLE = Map.of(
      "u-all", Set.of("c-a", "c-b", "c-ab", "c-aa1", "c-null", "c-broken", "c-mall"),
      "u-self", Set.of("c-ab"),
      "u-a", Set.of("c-a", "c-mall"),
      "u-tree", Set.of("c-a", "c-aa1", "c-mall"),
      "u-reader", Set.of("c-a", "c-mall"),
      "u-empty", Set.of(),
      "u-none", Set.of());

  @BeforeEach void seed() throws Exception {
    try (var c = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
         var s = c.createStatement()) {
      s.execute("""
          drop schema public cascade; create schema public;
          create table departments(id text primary key,tenant_id text,parent_id text,status text);
          create table users(id text primary key,tenant_id text,supplier_id text,department_id text,status text);
          create table roles(id text primary key,tenant_id text,supplier_id text,scope text,data_scope text,permissions jsonb);
          create table user_roles(user_id text,role_id text);
          create table rfqs(id text primary key,tenant_id text,owner_id text,method text);
          create table purchase_demands(id text primary key,tenant_id text,department_id text);
          create table rfq_demands(tenant_id text,rfq_id text,demand_id text);
          create table order_settlements(id text,tenant_id text,order_id text,contract_id text,status text);
          create table purchase_orders(id text primary key,tenant_id text,rfq_id text,supplier_id text,amount numeric,
            status text,expected_receipt_date date,created_at timestamptz default now(),updated_at timestamptz default now(),
            delivery_address text,contact_name text,contact_phone text,payment_terms text);
          create table contracts(id text primary key,tenant_id text,contract_no text,contract_name text,related_order_id text,
            supplier_id text,amount numeric,status text,archive_status text,fulfillment_progress text,effective_date date,
            created_at timestamptz default now(),updated_at timestamptz default now(),sign_date date,expiry_date date,
            payment_terms text,warranty_terms text,renewal_status text);
          insert into departments values ('A','t',null,'active'),('A1','t','A','active'),('B','t',null,'active');
          insert into users values ('u-all','t',null,'A','active'),('u-self','t',null,'A','active'),
            ('u-a','t',null,'A','active'),('u-tree','t',null,'A','active'),('u-reader','t',null,'A','active'),
            ('u-none','t',null,'A','active'),('u-empty','t',null,null,'active'),('u-other','other',null,'B','active');
          insert into roles values
            ('all','t',null,'buyer','all','["buyer:contract:read","buyer:contract:manage"]'),
            ('self','t',null,'buyer','self','["buyer:contract:read","buyer:contract:manage"]'),
            ('a','t',null,'buyer','department','["buyer:contract:read","buyer:contract:manage"]'),
            ('tree','t',null,'buyer','department_and_below','["buyer:contract:read","buyer:contract:manage"]'),
            ('reader','t',null,'buyer','department','["buyer:contract:read"]');
          insert into user_roles values ('u-all','all'),('u-self','self'),('u-a','a'),('u-tree','tree'),('u-reader','reader'),('u-empty','a');
          insert into rfqs values ('r-a','t','u-a','询价'),('r-b','t','u-other','询价'),
            ('r-ab','t','u-self','询价'),('r-aa1','t','u-tree','询价'),('r-null','t','u-other','询价'),
            ('r-broken','t','u-other','询价'),('r-mall','t','u-a','商城'),('r-other','other','u-other','询价');
          insert into purchase_demands values ('d-a','t','A'),('d-a1','t','A1'),('d-b','t','B'),
            ('d-null','t',null),('d-other','other','A');
          insert into rfq_demands values ('t','r-a','d-a'),('t','r-b','d-b'),('t','r-ab','d-a'),('t','r-ab','d-b'),
            ('t','r-aa1','d-a'),('t','r-aa1','d-a1'),('t','r-null','d-null'),('t','r-broken','d-a'),
            ('t','r-broken','d-other'),('other','r-other','d-other');
          insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status)
            select replace(id,'r-','o-'),tenant_id,id,'supplier',100,'已收货' from rfqs;
          insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status) values ('o-orphan','t','missing','supplier',100,'已收货');
          insert into contracts(id,tenant_id,contract_no,contract_name,related_order_id,supplier_id,amount,status,archive_status,fulfillment_progress)
            select replace(id,'o-','c-'),tenant_id,id,'Original',id,supplier_id,amount,'草案','未归档','待同步' from purchase_orders;
          """);
    }
    var source = new PooledDataSource("org.postgresql.Driver", DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    var configuration = new Configuration(new Environment("scope-test", new JdbcTransactionFactory(), source));
    configuration.setMapUnderscoreToCamelCase(true);
    configuration.addMapper(ContractMapper.class);
    configuration.addMapper(PurchaseOrderMapper.class);
    configuration.addMapper(OrderAccessMapper.class);
    configuration.addMapper(DataScopeMapper.class);
    configuration.addMapper(PermissionMapper.class);
    session = new SqlSessionFactoryBuilder().build(configuration).openSession(true);
    contracts = session.getMapper(ContractMapper.class);
    scopes = new DataScopeService(session.getMapper(DataScopeMapper.class));
    var permissions = new PermissionService(session.getMapper(PermissionMapper.class));
    access = new ContractAccessService(contracts, permissions, scopes);
    attachments = new ContractAttachmentAccess(contracts, permissions, scopes);
    service = new ContractApplicationService(contracts, null, session.getMapper(PurchaseOrderMapper.class),
        scopes, null, null, null, null, null);
    ReflectionTestUtils.setField(service, "contractAccess", access);
  }

  @AfterEach void close() {
    TenantContext.clear();
    if (session != null) {
      var source = (PooledDataSource) session.getConfiguration().getEnvironment().getDataSource();
      session.close(); source.forceCloseAll();
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"u-all", "u-self", "u-a", "u-tree", "u-reader", "u-empty"})
  void listCreationMutationAndAttachmentUseTheSameWholeOrderScope(String user) {
    TenantContext.set("t", null, user);
    var expected = VISIBLE.get(user);
    assertThat(service.listCurrentTenantContracts(null, null, null)).extracting(c -> c.id())
        .containsExactlyInAnyOrderElementsOf(expected);
    for (String suffix : Set.of("a", "b", "ab", "aa1", "null", "broken", "mall", "other", "orphan")) {
      String contract = "c-" + suffix, order = "o-" + suffix;
      boolean readable = expected.contains(contract);
      boolean writable = readable && !"u-reader".equals(user);
      assertThat(session.getMapper(OrderAccessMapper.class).canAccessOrder("t", order, scopes.currentUserDataScope()))
          .as("order baseline: %s / %s", user, order).isEqualTo(readable);
      if (readable) assertThatCode(() -> attachments.requireAccess(contract, false)).doesNotThrowAnyException();
      else assertThatThrownBy(() -> attachments.requireAccess(contract, false)).isInstanceOf(PermissionDeniedException.class);
      if (writable) {
        assertThatCode(() -> access.requireOrder(order)).doesNotThrowAnyException();
        assertThatCode(() -> attachments.requireAccess(contract, true)).doesNotThrowAnyException();
        assertThat(service.updateCurrentTenantContract(contract, update())).extracting(c -> c.contractName()).isEqualTo("Edited");
        assertThat(service.createCurrentTenantContract(create(order)).relatedOrderId()).isEqualTo(order);
      } else {
        assertThatThrownBy(() -> access.requireOrder(order)).isInstanceOf(PermissionDeniedException.class);
        assertThatThrownBy(() -> attachments.requireAccess(contract, true)).isInstanceOf(PermissionDeniedException.class);
        assertThatThrownBy(() -> service.updateCurrentTenantContract(contract, update())).isInstanceOf(PermissionDeniedException.class);
        assertThatThrownBy(() -> service.createCurrentTenantContract(create(order))).isInstanceOf(PermissionDeniedException.class);
      }
    }
  }

  @Test void settlementFreezeDoesNotBroadenScopeOrPermitContractMutation(){
    TenantContext.set("t",null,"u-all");
    try(var statement=session.getConnection().createStatement()){statement.execute("insert into order_settlements values ('settlement','t','o-a','c-a','approved')");}catch(java.sql.SQLException e){throw new IllegalStateException(e);}
    assertThatThrownBy(()->service.updateCurrentTenantContract("c-a",update())).isInstanceOf(IllegalStateException.class).hasMessageContaining("清算");
    assertThat(service.listCurrentTenantContracts(null,null,null)).extracting(c->c.id()).contains("c-a");
  }

  @Test void missingRoleNeverBecomesUnrestricted() {
    TenantContext.set("t", null, "u-none");
    assertThat(scopes.currentUserDataScope().blocksAll()).isTrue();
    assertThatThrownBy(() -> service.listCurrentTenantContracts(null, null, null)).isInstanceOf(PermissionDeniedException.class);
    assertThatThrownBy(() -> service.createCurrentTenantContract(create("o-a"))).isInstanceOf(PermissionDeniedException.class);
    assertThatThrownBy(() -> attachments.requireAccess("c-a", false)).isInstanceOf(PermissionDeniedException.class);
  }

  private CreateContractRequest create(String order) {
    return new CreateContractRequest("new-" + order, "New", order, BigDecimal.valueOf(100), "草案", "待同步",
        null, null, null, null, null);
  }

  private UpdateContractRequest update() {
    return new UpdateContractRequest("edited", "Edited", BigDecimal.valueOf(100), "草案", "待同步",
        null, null, null, null, null);
  }
}
