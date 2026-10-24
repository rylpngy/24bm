package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.procurement.common.tenant.TenantContext;
import com.procurement.sourcing.application.ProcurementExecutionApplicationService;
import com.procurement.sourcing.infrastructure.ProcurementExecutionMapper;
import com.procurement.attachment.application.AttachmentApplicationService;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@org.springframework.test.annotation.DirtiesContext
class ProcurementExecutionPostgresIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl); r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword); r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired ProcurementExecutionApplicationService execution;
  @Autowired ProcurementExecutionMapper mapper;
  @Autowired com.procurement.identity.infrastructure.DataScopeMapper roleScopes;
  @Autowired com.procurement.identity.application.DataScopeService scopes;
  @Autowired com.procurement.order.application.OrderAccessService orderAccess;
  @MockBean AttachmentApplicationService attachments;
  @MockBean UnifiedWorkflowApplicationService workflow;
  @MockBean com.procurement.common.storage.ObjectStorageService storage;
  String tenant,user,rfq,order,invoice,demand,contract;

  @BeforeEach void seed() {
    String id = UUID.randomUUID().toString(); tenant="e-"+id; user="u-"+id; rfq="r-"+id;
    order="o-"+id; invoice="i-"+id; demand="d-"+id; contract="c-"+id;
    String supplier="s-"+id;
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Execution','starter','active')",tenant);
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Manager','active')",user,tenant);
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions) values (?,?,'buyer','Manager','[\"buyer:*\"]')","role-"+id,tenant);
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)",user,"role-"+id);
    jdbc.update("insert into enterprises(id,name,type) values (?,'Supplier','supplier')",supplier);
    jdbc.update("insert into purchase_demands(id,tenant_id,title,department_id,requester_id,budget,status) values (?,?,'Demand','dep',?,150,'已转询价')",demand,tenant,user);
    jdbc.update("update purchase_demands set purpose='Research equipment',priority='紧急',expected_delivery_date=current_date+10 where id=?",demand);
    jdbc.update("insert into materials(id,tenant_id,code,name,category,unit) values (?,?,'MAT-1','Research instrument','Equipment','台')","mat-"+id,tenant);
    jdbc.update("insert into purchase_demand_items(id,tenant_id,demand_id,material_id,quantity) values (?,?,?,?,10)","di-"+id,tenant,demand,"mat-"+id);
    jdbc.update("insert into rfqs(id,tenant_id,title,status,deadline_at,owner_id,awarded_supplier_id) values (?,?,'Execution','已定标',now(),?,?)",rfq,tenant,user,supplier);
    jdbc.update("insert into rfq_demands(id,tenant_id,rfq_id,demand_id) values (?,?,?,?)","rd-"+id,tenant,rfq,demand);
    jdbc.update("insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date) values (?,?,?,?,100,'已收货',current_date)",order,tenant,rfq,supplier);
    jdbc.update("insert into order_line_items(id,tenant_id,order_id,description,quantity,unit_price,line_amount) values (?,?,?,'Item',10,10,100)","ol-"+id,tenant,order);
    jdbc.update("insert into receipts(id,tenant_id,order_id,receiver_id,result,received_quantity,qualified_quantity,inspection_conclusion) values (?,?,?,?,'合格',10,10,'全部合格')","rec-"+id,tenant,order,user);
    jdbc.update("insert into receipt_line_items(id,tenant_id,receipt_id,order_line_id,description,ordered_quantity,received_quantity,qualified_quantity) values (?,?,?,?,'Item',10,10,10)","rl-"+id,tenant,"rec-"+id,"ol-"+id);
    jdbc.update("insert into contracts(id,tenant_id,contract_no,contract_name,related_order_id,supplier_id,amount,status) values (?,?,?,'Contract',?,?,100,'已生效')",contract,tenant,contract,order,supplier);
    jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,payment_status) values (?,?,?,?,100,'已付款')",invoice,tenant,supplier,order);
    jdbc.update("insert into invoice_line_items(id,tenant_id,invoice_id,order_line_id,description,quantity,unit_price,line_amount) values (?,?,?,?,'Item',10,10,100)","il-"+id,tenant,invoice,"ol-"+id);
    jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,created_by) values (?,?,?,'initial',100,'Bank evidence',?)","p-"+id,tenant,invoice,user);
    when(attachments.listCurrentTenantAttachmentEntities(anyString(),anyString())).thenReturn(List.of());
    when(attachments.procurementExecutionAttachmentMetadata(anyString(),anyString())).thenReturn(List.of());
    when(workflow.procurementExecutionHistory(anyList())).thenReturn(List.of());
    TenantContext.set(tenant,null,user);
  }
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void realSqlAggregatesWithoutFanoutAndArchivesAreImmutableStaleAndIdempotent() throws Exception {
    var progress=execution.get(rfq);
    assertThat(progress.canArchive()).isTrue();
    assertThat(progress.budgetAmount()).isEqualByComparingTo("150");
    assertThat(progress.paidAmount()).isEqualByComparingTo("100");
    var first=execution.archive(rfq,"Snapshot");
    String snapshot=jdbc.queryForObject("select snapshot::text from procurement_execution_archives where id=?",String.class,first.id());
    assertThat(snapshot).contains("Research equipment","Research instrument","expectedDeliveryDate","demandItems");
    assertThat(execution.archive(rfq,"Retry").id()).isEqualTo(first.id());
    byte[] original=execution.download(rfq,first.id());
    jdbc.update("update purchase_demands set budget=200 where id=?",demand);
    assertThat(execution.get(rfq).archives()).allSatisfy(a -> assertThat(a.stale()).isTrue());
    assertThat(execution.download(rfq,first.id())).isEqualTo(original);
    assertThat(execution.archive(rfq,"New business state").id()).isNotEqualTo(first.id());
    assertThatThrownBy(() -> jdbc.update("update procurement_execution_archives set remark='tampered' where id=?",first.id()))
        .isInstanceOf(org.springframework.dao.DataAccessException.class);
    assertThat(mapper.snapshot("another-tenant",rfq)).isNull();
  }

  @Test void concurrentArchiveRequestsShareOneContentIdentity() throws Exception {
    try (var pool=Executors.newFixedThreadPool(2)) {
      var start=new CountDownLatch(1);
      Callable<String> task=() -> { TenantContext.set(tenant,null,user); try { start.await(); return execution.archive(rfq,"Concurrent").id(); } finally { TenantContext.clear(); } };
      var a=pool.submit(task); var b=pool.submit(task); start.countDown();
      assertThat(a.get(30,TimeUnit.SECONDS)).isEqualTo(b.get(30,TimeUnit.SECONDS));
    }
  }

  @Test void historicalPaidWithoutEntriesBlocksRatherThanInventsZero() {
    jdbc.update("delete from invoice_payment_entries where tenant_id=?",tenant);
    assertThat(execution.get(rfq).paidAmount()).isNull();
    assertThat(execution.get(rfq).canArchive()).isFalse();
    assertThatThrownBy(() -> execution.archive(rfq,"No evidence")).isInstanceOf(IllegalStateException.class);
  }

  @Test void missingReadPermissionAndDifferentTenantAreDenied() {
    jdbc.update("update roles set permissions='[\"buyer:rfq:read\"]' where tenant_id=?",tenant);
    assertThatThrownBy(() -> execution.get(rfq)).isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    assertThatThrownBy(() -> execution.archive(rfq,"")).isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    TenantContext.set("other",null,user);
    assertThatThrownBy(() -> execution.get(rfq)).isInstanceOf(RuntimeException.class);
  }

  @Test void mergedDemandScopeDeniesTheWholeProjectInsteadOfHidingOneDemand() {
    String ownDepartment="own-dep-"+UUID.randomUUID();
    String otherDepartment="other-dep-"+UUID.randomUUID();
    jdbc.update("insert into departments(id,tenant_id,name) values (?,?,'Own department'),(?,?,'Other department')",
        ownDepartment,tenant,otherDepartment,tenant);
    jdbc.update("update users set department_id=? where id=? and tenant_id=?",ownDepartment,user,tenant);
    jdbc.update("update purchase_demands set department_id=? where id=? and tenant_id=?",ownDepartment,demand,tenant);
    assertThat(jdbc.update("update roles set data_scope='department' where tenant_id=?",tenant)).isEqualTo(1);
    assertThat(roleScopes.listUserRoleDataScopes(user)).containsExactly("department");
    var scope=scopes.currentUserDataScope();
    assertThat(scope.restricted()).isTrue();
    assertThat(scope.requesterId()).isNull();
    assertThat(scope.departmentIds()).containsExactly(ownDepartment);
    assertThatCode(() -> orderAccess.requireRfq(rfq,"buyer:rfq:read")).doesNotThrowAnyException();
    assertThatCode(() -> execution.get(rfq)).doesNotThrowAnyException();
    String other="outsider-"+UUID.randomUUID();
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Other requester','active')",other,tenant);
    String hidden="hidden-"+UUID.randomUUID();
    jdbc.update("insert into purchase_demands(id,tenant_id,title,department_id,requester_id,budget,status) values (?,?,'Hidden demand',?,?,30,'已转询价')",hidden,tenant,otherDepartment,other);
    jdbc.update("insert into rfq_demands(id,tenant_id,rfq_id,demand_id) values (?,?,?,?)","link-"+UUID.randomUUID(),tenant,rfq,hidden);
    assertThat(roleScopes.listUserRoleDataScopes(user)).containsExactly("department");
    assertThatThrownBy(() -> orderAccess.requireRfq(rfq,"buyer:rfq:read")).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    assertThatThrownBy(() -> execution.get(rfq)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    assertThatThrownBy(() -> execution.archive(rfq,"Cross-department archive must fail")).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
  }
}
