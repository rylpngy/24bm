package com.procurement;

import static org.assertj.core.api.Assertions.*;
import com.procurement.buyer.api.BudgetContracts.*;
import com.procurement.buyer.application.*;
import com.procurement.buyer.domain.BudgetChange;
import com.procurement.buyer.infrastructure.BudgetLifecycleMapper;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.process.api.*;
import com.procurement.process.application.ProcessDefinitionApplicationService;
import com.procurement.workflow.api.CompleteWorkflowTaskRequest;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import java.math.BigDecimal;
import java.time.ZoneId;
import java.time.Year;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@SpringBootTest
@Testcontainers
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class BudgetLifecycleIT {
  @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url",DB::getJdbcUrl);r.add("spring.datasource.username",DB::getUsername);r.add("spring.datasource.password",DB::getPassword);
    r.add("keycloak.enabled",()->false);r.add("app.seed.locations",()->"");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired BudgetLifecycleService budgets;
  @Autowired BudgetLifecycleMapper mapper;
  @Autowired BudgetControlService control;
  @Autowired UnifiedWorkflowApplicationService workflow;
  @Autowired ProcessDefinitionApplicationService definitions;
  @Autowired PurchaseDemandApplicationService demands;
  @Autowired PlatformTransactionManager transactions;
  String tenant,department,other,author,reviewer,role;
  final String year=Year.now(ZoneId.of("Asia/Shanghai")).toString();
  @BeforeEach void seed() {
    String id=UUID.randomUUID().toString();tenant="budget-it-"+id;department="dept-"+id;other="other-"+id;
    author="author-"+id;reviewer="reviewer-"+id;role="role-"+id;
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Budget','starter','active')",tenant);
    for(String d:List.of(department,other))jdbc.update("insert into departments(id,tenant_id,name,status) values (?,?,?,'active')",d,tenant,d);
    for(String u:List.of(author,reviewer))jdbc.update("insert into users(id,tenant_id,name,status,department_id) values (?,?,?,'active',?)",u,tenant,u,department);
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions,data_scope) values (?,?,'buyer','Budget admin','[\"buyer:*\"]'::jsonb,'all')",role,tenant);
    for(String u:List.of(author,reviewer))jdbc.update("insert into user_roles(user_id,role_id) values (?,?)",u,role);
    context(author);
    for(String type:List.of("budget_change","budget_exception","purchase_demand"))publish(type);
  }
  @AfterEach void clear() { TenantContext.clear(); }
  void context(String user) { TenantContext.set(tenant,null,user); }
  void publish(String type) {
    var definition=definitions.createProcess(new CreateProcessDefinitionRequest("Budget "+type,"","file-text",type));
    String flow="{\"steps\":[{\"id\":\"review\",\"type\":\"approver\",\"title\":\"Budget review\",\"assignment\":{\"type\":\"role\",\"roleId\":\""+role+"\"}}]}";
    definitions.updateProcess(definition.id(),new UpdateProcessDefinitionRequest("Budget "+type,"","draft","{\"fields\":[]}",flow,type));
    definitions.publishProcess(definition.id());
  }
  BudgetDraft draft(String kind,String amount,String type,String target) {
    return new BudgetDraft(department,year,kind,new BigDecimal(amount),type,target,"Budget request","Actual procurement budget basis",0);
  }
  BudgetChange approve(BudgetChange request) {
    context(reviewer);
    var task=workflow.listCurrentUserTasks().stream().filter(t->t.businessId().equals(request.id())).findFirst().orElseThrow();
    workflow.completeCurrentUserTask(task.taskId(),new CompleteWorkflowTaskRequest("approve","Verified"));
    context(author);return budgets.request(request.id());
  }
  void initial(String amount) { var request=budgets.create(draft("initial",amount,null,null));approve(budgets.submit(request.id())); }
  String demand(String amount) {
    String id="budget-demand-"+UUID.randomUUID();
    jdbc.update("insert into purchase_demands(id,tenant_id,title,department_id,requester_id,budget,status) values (?,?,'Budget demand',?,?,?,'草稿')",id,tenant,department,author,new BigDecimal(amount));return id;
  }
  void withdrawDemand(String id) {
    var history=workflow.getCurrentTenantBusinessHistory("purchase_demand",id);
    workflow.withdrawPurchaseDemand(history.workflowInstanceId(),"Correct demand");
  }
  void mode(String value) { var current=budgets.policy();budgets.updatePolicy(new BudgetPolicyUpdate(value,current.revision(),"Budget policy test",true)); }

  @Test void onlyRealApprovalActivatesBudgetAndOldDraftsCannotOverwriteNewVersions() {
    var request=budgets.create(draft("initial","1000",null,null));
    assertThat(mapper.total(tenant,department,year)).isNull();
    var submitted=budgets.submit(request.id());
    assertThat(mapper.total(tenant,department,year)).isNull();
    assertThat(workflow.listCurrentUserTasks()).isEmpty();
    context(reviewer);var task=workflow.listCurrentUserTasks().getFirst();context(author);
    assertThatThrownBy(()->workflow.completeCurrentUserTask(task.taskId(),new CompleteWorkflowTaskRequest("approve","self")))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    approve(submitted);assertThat(mapper.total(tenant,department,year)).isEqualByComparingTo("1000");
    var first=budgets.create(draft("adjustment","1400",null,null));
    var stale=budgets.create(draft("adjustment","1800",null,null));
    approve(budgets.submit(first.id()));
    assertThatThrownBy(()->budgets.submit(stale.id())).hasMessageContaining("基线");
    assertThat(mapper.total(tenant,department,year)).isEqualByComparingTo("1400");
    assertThat(mapper.version(tenant,department,year)).isEqualTo(2);
    assertThat(new BigDecimal(workflow.getCurrentTenantHistory(submitted.workflowInstanceId()).businessSnapshot().get("targetAmount").toString())).isEqualByComparingTo("1000");
  }

  @Test void rejectionAndWithdrawalKeepHistoryWithoutChangingActiveAmounts() {
    var request=budgets.submit(budgets.create(draft("initial","700",null,null)).id());
    context(reviewer);var task=workflow.listCurrentUserTasks().getFirst();
    workflow.completeCurrentUserTask(task.taskId(),new CompleteWorkflowTaskRequest("reject","Revise amounts"));
    context(author);assertThat(budgets.request(request.id()).status()).isEqualTo("rejected");assertThat(mapper.total(tenant,department,year)).isNull();
    var another=budgets.submit(budgets.create(draft("initial","800",null,null)).id());
    budgets.withdraw(another.id(),"Correct application");
    assertThat(workflow.getCurrentTenantHistory(another.workflowInstanceId()).status()).isEqualTo("cancelled");
    assertThat(budgets.request(another.id()).status()).isEqualTo("withdrawn");assertThat(mapper.total(tenant,department,year)).isNull();
  }

  @Test void draftRevisionAndPublishedCustomFormsAreEnforced() {
    var request=budgets.create(draft("initial","800",null,null));
    var edit=new BudgetDraft(department,year,"initial",new BigDecimal("1000"),null,null,"Revised budget","New basis",0);
    var saved=budgets.edit(request.id(),edit);assertThat(saved.revision()).isEqualTo(1);
    assertThatThrownBy(()->budgets.edit(request.id(),edit)).hasMessageContaining("已变更");
    var definition=definitions.listCurrentTenantProcesses().stream().filter(p->"budget_change".equals(p.businessType())).findFirst().orElseThrow();
    definitions.updateProcess(definition.id(),new UpdateProcessDefinitionRequest(definition.name(),"","draft",
        "{\"fields\":[{\"id\":\"basis\",\"type\":\"text\",\"label\":\"Budget basis\",\"required\":true}]}",definition.flowSchema(),"budget_change"));
    definitions.publishProcess(definition.id());
    assertThatThrownBy(()->budgets.submit(request.id())).isInstanceOf(IllegalArgumentException.class);
    assertThat(budgets.request(request.id()).status()).isEqualTo("draft");
    var submitted=budgets.submit(request.id(),Map.of("basis","Approved procurement plan"));
    assertThat(workflow.getCurrentTenantHistory(submitted.workflowInstanceId()).formData()).containsEntry("basis","Approved procurement plan");
    approve(submitted);assertThat(mapper.total(tenant,department,year)).isEqualByComparingTo("1000");
  }

  @Test void aCheckoutExceptionCoversOneAtomicSplitOrderTransactionButCannotBeReplayedLater() {
    initial("1000");mode("approval");
    var grant=approve(budgets.submit(budgets.create(draft("exception","1600","department_order",department)).id()));
    new TransactionTemplate(transactions).executeWithoutResult(status->{
      control.lock(tenant);for(String amount:List.of("700","700","100"))standaloneOrder(amount);
    });
    assertThat(control.position(tenant,department,year).committed()).isEqualByComparingTo("1500");
    assertThat(budgets.request(grant.id()).consumedAt()).isNotNull();
    assertThatThrownBy(()->new TransactionTemplate(transactions).executeWithoutResult(status->{control.lock(tenant);standaloneOrder("50");}))
        .hasMessageContaining("例外审批");
    assertThat(jdbc.queryForObject("select count(*) from purchase_orders where tenant_id=?",Integer.class,tenant)).isEqualTo(3);
    assertThat(control.position(tenant,department,year).committed()).isEqualByComparingTo("1500");
  }

  void standaloneOrder(String amount) {
    String id=UUID.randomUUID().toString(),supplier="s-"+id,rfq="r-"+id,order="o-"+id;
    jdbc.update("insert into enterprises(id,name,type) values (?,'Supplier','supplier')",supplier);
    jdbc.update("insert into rfqs(id,tenant_id,title,status,deadline_at,owner_id) values (?,?,'Checkout','已定标',now(),?)",rfq,tenant,author);
    jdbc.update("insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date) values (?,?,?,?,?,'待供应商确认',current_date)",order,tenant,rfq,supplier,new BigDecimal(amount));
    control.recordOrder(tenant,order,rfq);
  }

  @Test void warningIsDefaultHardModeRollsBackAndScopedExceptionsAreSingleUse() {
    assertThat(budgets.policy().mode()).isEqualTo("warning");initial("1000");
    String first=demand("800"),second=demand("300");
    demands.submit(first,Map.of());demands.submit(second,Map.of());
    assertThat(control.position(tenant,department,year).pending()).isEqualByComparingTo("1100");
    withdrawDemand(second);mode("hard");
    assertThatThrownBy(()->demands.submit(second,Map.of())).hasMessageContaining("硬拦截");
    assertThat(jdbc.queryForObject("select status from purchase_demands where id=?",String.class,second)).isEqualTo("草稿");
    assertThat(control.position(tenant,department,year).pending()).isEqualByComparingTo("800");
    mode("approval");var grant=approve(budgets.submit(budgets.create(draft("exception","1100","purchase_demand",second)).id()));
    demands.submit(second,Map.of());assertThat(budgets.request(grant.id()).consumedAt()).isNotNull();
    withdrawDemand(second);assertThatThrownBy(()->demands.submit(second,Map.of())).hasMessageContaining("例外审批");
    var unused=approve(budgets.submit(budgets.create(draft("exception","1100","purchase_demand",second)).id()));
    approve(budgets.submit(budgets.create(draft("adjustment","1001",null,null)).id()));
    assertThatThrownBy(()->demands.submit(second,Map.of())).hasMessageContaining("例外审批");
    assertThat(budgets.request(unused.id()).consumedAt()).isNull();
  }

  @Test void concurrentReservationsCannotBothSpendTheSameBalance() throws Exception {
    initial("1000");mode("hard");String a=demand("700"),b=demand("700");
    try(var pool=Executors.newFixedThreadPool(2)) {
      var start=new CountDownLatch(1);
      var results=new ArrayList<Future<Boolean>>();
      for(String id:List.of(a,b))results.add(pool.submit(()->{context(author);try{start.await();demands.submit(id,Map.of());return true;}catch(IllegalStateException ex){return false;}finally{TenantContext.clear();}}));
      start.countDown();int passed=0;for(var result:results)if(result.get(30,TimeUnit.SECONDS))passed++;
      assertThat(passed).isEqualTo(1);
    }
    assertThat(control.position(tenant,department,year).pending()).isEqualByComparingTo("700");
  }

  @Test void departmentScopesAndPolicyRevisionCannotBeBypassed() {
    initial("1000");
    jdbc.update("update roles set data_scope='department' where id=?",role);
    assertThatThrownBy(()->budgets.create(new BudgetDraft(other,year,"initial",BigDecimal.TEN,null,null,"Foreign department","Reason",0)))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    assertThat(budgets.policy().canConfigure()).isFalse();
    assertThatThrownBy(()->mode("hard")).isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    jdbc.update("update roles set data_scope='all' where id=?",role);
    mode("warning");assertThatThrownBy(()->budgets.updatePolicy(new BudgetPolicyUpdate("hard",0,"stale policy",true))).hasMessageContaining("已被修改");
    String foreign="foreign-"+tenant;jdbc.update("insert into tenants(id,name,plan,status) values (?,'Foreign','starter','active')",foreign);
    var id=budgets.create(draft("adjustment","1200",null,null)).id();TenantContext.set(foreign,null,author);
    assertThatThrownBy(()->budgets.request(id)).hasMessageContaining("不存在");
  }

  @Test void committedOrdersAndPaymentsAreOneExposureAndArchiveReleasesOnlyTheUnusedAmount() {
    initial("2000");String d=demand("1000");jdbc.update("update purchase_demands set status='已通过' where id=?",d);
    String rfq="rfq-"+UUID.randomUUID(),supplier="supplier-"+UUID.randomUUID(),order="order-"+UUID.randomUUID(),invoice="invoice-"+UUID.randomUUID();
    jdbc.update("insert into enterprises(id,name,type) values (?,'Supplier','supplier')",supplier);
    jdbc.update("insert into rfqs(id,tenant_id,title,status,deadline_at,owner_id) values (?,?,'Budget project','已定标',now(),?)",rfq,tenant,author);
    jdbc.update("insert into rfq_demands(id,tenant_id,rfq_id,demand_id) values (?,?,?,?)","link-"+rfq,tenant,rfq,d);
    jdbc.update("insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date) values (?,?,?,?,900,'已收货',current_date)",order,tenant,rfq,supplier);
    jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,payment_status) values (?,?,?,?,900,'已付款')",invoice,tenant,supplier,order);
    assertThat(control.position(tenant,department,year).paidAmount()).isNull();
    jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,created_by) values (?,?,?,'budget-test',900,'payment-evidence',?)","pay-"+order,tenant,invoice,author);
    var before=control.position(tenant,department,year);
    assertThat(before.committed()).isEqualByComparingTo("1000");assertThat(before.orderAmount()).isEqualByComparingTo("900");assertThat(before.paidAmount()).isEqualByComparingTo("900");
    // Metadata fixtures isolate accounting arithmetic; full archive readiness is covered by ProcurementExecutionPostgresIT and HTTP.
    String archive="archive-"+UUID.randomUUID();
    jdbc.update("insert into procurement_execution_archives(id,tenant_id,rfq_id,snapshot,sha256,created_by,remark,zip_data) values (?,?,?,'{}'::jsonb,?,?,'Budget arithmetic',?)",archive,tenant,rfq,"a".repeat(64),author,new byte[]{1});
    control.settleProject(tenant,rfq,archive,new BigDecimal("900"),new BigDecimal("900"));
    assertThat(control.position(tenant,department,year).committed()).isEqualByComparingTo("900");
    assertThat(control.position(tenant,department,year).releasedAmount()).isEqualByComparingTo("100");
    jdbc.update("update purchase_orders set amount=1100 where id=?",order);
    assertThat(control.position(tenant,department,year).committed()).isEqualByComparingTo("1100");
    assertThat(control.position(tenant,department,year).releasedAmount()).isZero();
  }

  @Test void exceptionsExpireAndUnassignedOrdersBlockActivationUntilExplicitlyAllocated() {
    initial("1000");String id=demand("1200");var exception=approve(budgets.submit(budgets.create(draft("exception","1200","purchase_demand",id)).id()));
    jdbc.update("update budget_change_requests set expires_at=now()-interval '1 second' where id=?",exception.id());mode("approval");
    assertThatThrownBy(()->demands.submit(id,Map.of())).hasMessageContaining("例外审批");mode("warning");
    String supplier="s-"+tenant,rfq="r-"+tenant,order="o-"+tenant;
    jdbc.update("insert into enterprises(id,name,type) values (?,'Supplier','supplier')",supplier);
    jdbc.update("insert into rfqs(id,tenant_id,title,status,deadline_at,owner_id) values (?,?,'Direct','已定标',now(),?)",rfq,tenant,author);
    jdbc.update("insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date) values (?,?,?,?,200,'待供应商确认',current_date)",order,tenant,rfq,supplier);
    assertThat(budgets.policy().unassignedOrderCount()).isEqualTo(1);
    assertThatThrownBy(()->mode("hard")).hasMessageContaining("未归属");
    budgets.assignOrder(order,new BudgetAssignment(department,year,"Verified original order ownership"));
    assertThat(budgets.policy().unassignedOrderCount()).isZero();mode("hard");
    assertThat(control.position(tenant,department,year).committed()).isEqualByComparingTo("200");
    assertThatThrownBy(()->budgets.assignOrder(order,new BudgetAssignment(other,year,"Change"))).hasMessageContaining("不允许覆盖");
    assertThat(budgets.export(department,year)).isNotEmpty();
  }
}
