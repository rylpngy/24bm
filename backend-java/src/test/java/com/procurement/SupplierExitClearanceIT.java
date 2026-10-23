package com.procurement;

import static org.assertj.core.api.Assertions.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.application.SupplierExitApplicationService;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@Transactional
@org.springframework.test.annotation.DirtiesContext
class SupplierExitClearanceIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl);
    r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword);
    r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired BuyerSupplierRelationMapper relations;
  @Autowired SupplierExitApplicationService exits;
  @Autowired com.procurement.supplier.application.SupplierExitItemsService exitItems;

  void detailPermissions(String scope) {
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions,data_scope) values ('ecrole','eca','buyer','Reader','[\"buyer:supplier:read\",\"buyer:order:read\",\"buyer:invoice:read\"]',?)",scope);
    jdbc.update("insert into user_roles(user_id,role_id) values ('ecu','ecrole')");
  }
  com.procurement.supplier.api.SupplierExitItemsPage detail(String kind, int page, int size) {
    return exitItems.list("ecrel",kind,page,size);
  }

  @BeforeEach void seed() {
    jdbc.update("insert into tenants(id,name,plan,status) values ('eca','A','starter','active'),('ecb','B','starter','active')");
    jdbc.update("insert into enterprises(id,name,type) values ('ecs','Supplier','supplier'),('ecother','Other','supplier')");
    jdbc.update("insert into users(id,tenant_id,name,status) values ('ecu','eca','User','active'),('ecbu','ecb','Other','active')");
    jdbc.update("insert into rfqs(id,tenant_id,title,status,deadline_at,owner_id) values ('ecr','eca','RFQ','草稿',now(),'ecu'),('ecbr','ecb','RFQ','草稿',now(),'ecbu')");
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level) values ('ecrel','eca','ecs','退出审批中','B')");
    TenantContext.set("eca", null, "ecu");
  }
  @AfterEach void clear() { TenantContext.clear(); }
  com.procurement.supplier.api.SupplierExitRiskResponse risk() { return relations.exitRisk("eca","ecs"); }
  void order() {
    jdbc.update("insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date) values ('eco','eca','ecr','ecs',100,'已收货',current_date)");
  }
  void invoice(String status) {
    jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,payment_status) values ('eci','eca','ecs','eco',100,?)", status);
  }
  void payment(int amount) {
    jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,created_by) values ('ecep','eca','eci','p',?,'proof','ecu')",amount);
  }
  void contract() {
    jdbc.update("insert into contracts(id,tenant_id,contract_no,contract_name,related_order_id,supplier_id,amount,status,archive_status) values ('ecc','eca','C','Contract','eco','ecs',100,'已完成','已归档')");
  }
  void milestone(int amount, String status) {
    jdbc.update("insert into contract_payment_milestones(id,tenant_id,contract_id,name,percent,amount,status) values ('ecm','eca','ecc','Final',100,?,?)",amount,status);
  }
  void allocation(int amount) {
    jdbc.update("insert into contract_payment_allocations(id,tenant_id,entry_id,milestone_id,amount) values ('ecal','eca','ecep','ecm',?)",amount);
  }
  @Test void orderCoverageAndUnknownStatusesBlock() {
    assertThat(risk().blocked()).isFalse();
    order();
    assertThat(risk().uninvoicedOrderCount()).isEqualTo(1);
    invoice("待付款");
    assertThat(risk().paymentVerificationRequiredCount()).isZero();
    assertThat(risk().remainingInvoiceAmount()).isEqualByComparingTo("100");
    jdbc.update("update purchase_orders set status='已取消' where id='eco'");
    assertThat(risk().unreceivedOrderCount()).isEqualTo(1);
    jdbc.update("update invoices set amount=50 where id='eci'");
    assertThat(risk().uninvoicedOrderCount()).isEqualTo(1);
    assertThat(risk().paymentVerificationRequiredCount()).isEqualTo(1);
  }
  @Test void legacyAndInconsistentLedgerNeverInventRemaining() {
    order(); invoice("已付款");
    assertThat(risk().paymentVerificationRequiredCount()).isEqualTo(1);
    assertThat(risk().remainingInvoiceAmount()).isNull();
    assertThat(risk().unpaidInvoiceCount()).isEqualTo(1);
    payment(40);
    assertThat(risk().blocked()).isTrue();
    assertThat(risk().remainingInvoiceAmount()).isNull();
    jdbc.update("update invoices set payment_status='部分付款' where id='eci'");
    assertThat(risk().remainingInvoiceAmount()).isEqualByComparingTo("60");
    jdbc.update("update invoice_payment_entries set amount=100 where id='ecep'");
    jdbc.update("update invoices set payment_status='已付款' where id='eci'");
    assertThat(risk().blocked()).isFalse();
    jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,created_by,reversal_of) values ('ecreverse','eca','eci','r',-100,'proof','ecu','ecep')");
    assertThat(risk().paymentVerificationRequiredCount()).isEqualTo(1);
    jdbc.update("update invoices set payment_status='待付款' where id='eci'");
    assertThat(risk().remainingInvoiceAmount()).isEqualByComparingTo("100");
  }
  @Test void archivedMilestonesMustHaveVerifiedMatchingAllocationAndPlan() {
    order(); invoice("已付款"); payment(100); contract(); milestone(100,"已付");
    assertThat(risk().unarchivedContractCount()).isZero();
    assertThat(risk().paymentVerificationRequiredCount()).isEqualTo(1);
    allocation(100);
    assertThat(risk().blocked()).isFalse();
    jdbc.update("update contract_payment_allocations set amount=40 where id='ecal'");
    jdbc.update("update contract_payment_milestones set status='部分已付' where id='ecm'");
    assertThat(risk().paymentVerificationRequiredCount()).isEqualTo(1);
    jdbc.update("update contract_payment_allocations set amount=100 where id='ecal'");
    jdbc.update("update contract_payment_milestones set amount=120 where id='ecm'");
    assertThat(risk().paymentVerificationRequiredCount()).isEqualTo(1);
    assertThat(risk().remainingInvoiceAmount()).isNull();
  }
  @Test void contractsAndAfterSalesBlockAndCompletionRechecksFreshRisk() {
    order(); invoice("已付款"); payment(100); contract();
    assertThat(risk().blocked()).isFalse();
    jdbc.update("update contracts set archive_status='未归档' where id='ecc'");
    assertThat(risk().unarchivedContractCount()).isEqualTo(1);
    jdbc.update("update contracts set archive_status='已归档' where id='ecc'");
    jdbc.update("insert into mall_after_sales(id,tenant_id,order_id,order_line_id,supplier_id,type,quantity,reason,status) values ('ecas','eca','eco','line','ecs','维修',1,'Reason','处理中')");
    var instance = new WorkflowBusinessInstance("instance","eca","buyer_supplier_exit","ecrel","v1","flow",
        "processing","ecu",null,null,"{}","{}",null,null,null,null);
    assertThatThrownBy(() -> exits.onCompleted(instance,new WorkflowCompletion(true,"ecu","同意")))
        .isInstanceOf(IllegalStateException.class);
    assertThat(jdbc.queryForObject("select status from buyer_supplier_relations where id='ecrel'",String.class)).isEqualTo("退出审批中");
    assertThat(risk().openAfterSalesCount()).isEqualTo(1);
    for (String status : new String[]{"已完成","已拒绝"}) {
      jdbc.update("update mall_after_sales set status=? where id='ecas'",status);
      assertThat(risk().blocked()).isFalse();
    }
  }
  @Test void scopeAndInvoiceAmountPolicyAreConservative() {
    jdbc.update("insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date) values ('ecbo','ecb','ecbr','ecs',100,'待发货',current_date),('ecoo','eca','ecr','ecother',100,'待发货',current_date)");
    jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,payment_status) values ('ecbi','ecb','ecs','ecbo',100,'已付款'),('ecoi','eca','ecother','ecoo',100,'已付款')");
    jdbc.update("insert into contracts(id,tenant_id,contract_no,contract_name,related_order_id,supplier_id,amount,status) values ('ecbc','ecb','BC','Contract','ecbo','ecs',100,'履约中'),('ecoc','eca','OC','Contract','ecoo','ecother',100,'履约中')");
    jdbc.update("insert into mall_after_sales(id,tenant_id,order_id,order_line_id,supplier_id,type,quantity,reason) values ('ecbas','ecb','ecbo','line','ecs','维修',1,'Reason'),('ecoas','eca','ecoo','line','ecother','维修',1,'Reason')");
    assertThat(risk().blocked()).isFalse();
    order(); invoice("已付款"); payment(100);
    assertThat(risk().blocked()).isFalse();
    jdbc.update("update invoices set supplier_id='ecother' where id='eci'");
    assertThat(risk().paymentVerificationRequiredCount()).isEqualTo(1);
    jdbc.update("update invoices set supplier_id='ecs',amount=120 where id='eci'");
    jdbc.update("update invoice_payment_entries set amount=120 where id='ecep'");
    assertThat(risk().paymentVerificationRequiredCount()).isEqualTo(1);
    jdbc.update("update invoices set amount=100 where id='eci'");
    jdbc.update("update invoice_payment_entries set amount=100,tenant_id='ecb' where id='ecep'");
    assertThat(risk().paymentVerificationRequiredCount()).isEqualTo(1);
    assertThat(risk().remainingInvoiceAmount()).isNull();
  }

  @Test void overpaymentAndUnknownPaymentStatusesRequireVerification() {
    order(); invoice("已付款"); payment(110);
    assertThat(risk().paymentVerificationRequiredCount()).isEqualTo(1);
    assertThat(risk().remainingInvoiceAmount()).isNull();
    jdbc.update("delete from invoice_payment_entries where id='ecep'");
    for (String status : new String[]{"部分付款", "待审批", "未知"}) {
      jdbc.update("update invoices set payment_status=? where id='eci'",status);
      assertThat(risk().paymentVerificationRequiredCount()).isEqualTo(1);
      assertThat(risk().blocked()).isTrue();
    }
  }

  @Test void duplicateInvoicesRemainProhibitedByDatabasePolicy() {
    order(); invoice("待付款");
    assertThatThrownBy(() -> jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,payment_status) values ('ecdup','eca','ecs','eco',100,'待付款')"))
        .isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
  }

  @Test void archivedContractAmountMustMatchInvoiceWithoutMilestones() {
    order(); invoice("已付款"); payment(100); contract();
    assertThat(risk().blocked()).isFalse();
    jdbc.update("update contracts set amount=120 where id='ecc'");
    assertThat(risk().paymentVerificationRequiredCount()).isEqualTo(1);
    assertThat(risk().remainingInvoiceAmount()).isNull();
    assertThat(risk().blocked()).isTrue();
  }

  @Test void archivedContractAmountMustMatchEvenWithBalancedMilestones() {
    order(); invoice("已付款"); payment(100); contract(); milestone(100,"已付"); allocation(100);
    assertThat(risk().blocked()).isFalse();
    jdbc.update("update contracts set amount=120 where id='ecc'");
    assertThat(risk().paymentVerificationRequiredCount()).isEqualTo(1);
    assertThat(risk().remainingInvoiceAmount()).isNull();
    assertThat(risk().blocked()).isTrue();
  }

  @Test void exceptionPagesHaveStableCountsCoverageReasonsAndUnknownBalances() {
    detailPermissions("all"); order();
    jdbc.update("insert into rfqs(id,tenant_id,title,status,deadline_at,owner_id) values ('ecr2','eca','RFQ','草稿',now(),'ecu'),('ecr3','eca','RFQ','草稿',now(),'ecu')");
    jdbc.update("insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date) values ('eco2','eca','ecr2','ecs',100,'已收货',current_date),('eco3','eca','ecr3','ecs',100,'已收货',current_date)");
    invoice("已付款");
    jdbc.update("update invoices set amount=40 where id='eci'");
    var first = detail("uninvoiced",1,2);
    assertThat(first.total()).isEqualTo(risk().uninvoicedOrderCount()).isEqualTo(3);
    assertThat(first.items()).extracting(i -> i.id()).containsExactly("eco","eco2");
    assertThat(first.items().getFirst().invoicedAmount()).isEqualByComparingTo("40");
    assertThat(first.items().getFirst().remainingAmount()).isEqualByComparingTo("60");
    assertThat(first.items().get(1).remainingAmount()).isEqualByComparingTo("100");
    assertThat(first.items().getFirst().reason()).contains("不足");
    assertThat(first.items().getFirst().handlerLabel()).isEqualTo("采购处理岗位");
    assertThat(first.items().getFirst().invoiceId()).isNull();
    assertThat(detail("uninvoiced",2,2).items()).extracting(i -> i.id()).containsExactly("eco3");
    assertThat(detail("uninvoiced",3,2).items()).isEmpty();
    assertThat(detail("uninvoiced",3,2).total()).isEqualTo(3);
    var payment = detail("payment-verification",1,10);
    assertThat(payment.total()).isEqualTo(risk().paymentVerificationRequiredCount()).isEqualTo(1);
    var row = payment.items().getFirst();
    assertThat(row.invoiceId()).isEqualTo("eci");
    assertThat(row.orderId()).isEqualTo("eco");
    assertThat(row.reason()).contains("付款状态","订单与发票");
    assertThat(row.paidAmount()).isNull();
    assertThat(row.remainingAmount()).isNull();
    assertThat(row.handlerLabel()).isEqualTo("财务处理岗位");
  }

  @Test void abnormalOrderOrCoverageDoesNotInventUninvoicedRemaining() {
    detailPermissions("all"); order(); invoice("待付款");
    jdbc.update("update invoices set amount=-10 where id='eci'");
    assertThat(detail("uninvoiced",1,10).items().getFirst().remainingAmount()).isNull();
    jdbc.update("update purchase_orders set amount=-20 where id='eco'");
    assertThat(detail("uninvoiced",1,10).items().getFirst().remainingAmount()).isNull();
  }

  @Test void paymentReasonsIncludeContractAndMilestoneMismatches() {
    detailPermissions("all"); order(); invoice("已付款"); payment(100); contract(); milestone(100,"已付");
    jdbc.update("update contracts set amount=120 where id='ecc'");
    var row = detail("payment-verification",1,10).items().getFirst();
    assertThat(row.reason()).contains("合同金额","付款节点","分摊");
    assertThat(row.paidAmount()).isNull();
    assertThat(row.remainingAmount()).isNull();
    allocation(100);
    jdbc.update("update contracts set amount=100 where id='ecc'");
    assertThat(detail("payment-verification",1,10).total()).isZero();
    assertThat(risk().paymentVerificationRequiredCount()).isZero();
  }

  @Test void detailNeverLeaksForeignTenantSupplierOrMalformedCrossSupplierInvoice() {
    detailPermissions("all"); order(); invoice("已付款");
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level) values ('ecbrel','ecb','ecs','已准入','B')");
    jdbc.update("insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date) values ('ecbo','ecb','ecbr','ecs',100,'已收货',current_date),('ecoo','eca','ecr','ecother',100,'已收货',current_date)");
    jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,payment_status) values ('ecbi','ecb','ecs','ecbo',100,'已付款'),('ecoi','eca','ecother','ecoo',100,'已付款')");
    assertThat(detail("payment-verification",1,10).items()).extracting(i -> i.id()).containsExactly("eci");
    assertThatThrownBy(() -> exitItems.list("ecbrel","uninvoiced",1,10)).isInstanceOf(IllegalArgumentException.class);
    jdbc.update("update invoices set supplier_id='ecother' where id='eci'");
    assertThat(risk().paymentVerificationRequiredCount()).isEqualTo(1);
    assertThat(detail("payment-verification",1,10).items()).isEmpty();
    assertThat(detail("payment-verification",1,10).total()).isZero();
  }

  @Test void selfDepartmentAndBlocksAllFilterBeforeCountAndPagination() {
    detailPermissions("self"); order();
    jdbc.update("insert into users(id,tenant_id,name,status) values ('ecotheruser','eca','Other user','active')");
    jdbc.update("insert into rfqs(id,tenant_id,title,status,deadline_at,owner_id) values ('ecor','eca','RFQ','草稿',now(),'ecotheruser')");
    jdbc.update("insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date) values ('eca0','eca','ecor','ecs',100,'已收货',current_date)");
    assertThat(detail("uninvoiced",1,1).total()).isEqualTo(1);
    assertThat(detail("uninvoiced",1,1).items()).extracting(i -> i.id()).containsExactly("eco");
    assertThat(detail("uninvoiced",2,1).items()).isEmpty();
    invoice("已付款");
    jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,payment_status) values ('eca0i','eca','ecs','eca0',100,'已付款')");
    assertThat(detail("payment-verification",1,1).total()).isEqualTo(1);
    assertThat(detail("payment-verification",1,1).items()).extracting(i -> i.id()).containsExactly("eci");
    jdbc.update("update roles set data_scope='department' where id='ecrole'");
    assertThat(detail("payment-verification",1,10).total()).isZero();
    assertThat(detail("uninvoiced",1,10).total()).isZero();
    jdbc.update("insert into departments(id,tenant_id,name) values ('ecd','eca','Department'),('ecod','eca','Other department')");
    jdbc.update("update users set department_id='ecd' where id='ecu'");
    jdbc.update("insert into purchase_demands(id,tenant_id,title,department_id,requester_id,budget,status) values ('ecdem','eca','Demand','ecd','ecu',100,'草稿'),('ecodem','eca','Other demand','ecod','ecotheruser',100,'草稿')");
    jdbc.update("insert into rfq_demands(id,tenant_id,rfq_id,demand_id) values ('ecrd','eca','ecr','ecdem'),('ecord','eca','ecor','ecodem')");
    assertThat(detail("payment-verification",1,1).total()).isEqualTo(1);
    assertThat(detail("payment-verification",2,1).items()).isEmpty();
    jdbc.update("update invoices set amount=50 where tenant_id='eca'");
    assertThat(risk().uninvoicedOrderCount()).isEqualTo(2);
    assertThat(detail("uninvoiced",1,1).total()).isEqualTo(1);
    assertThat(detail("uninvoiced",1,1).items()).extracting(i -> i.id()).containsExactly("eco");
    jdbc.update("insert into rfq_demands(id,tenant_id,rfq_id,demand_id) values ('ecmixed','eca','ecr','ecodem')");
    assertThat(detail("uninvoiced",1,1).total()).isZero();
    assertThat(detail("payment-verification",1,1).total()).isZero();
  }

  @Test void realPermissionsRequireSupplierAndKindSpecificRead() {
    detailPermissions("all"); order();
    jdbc.update("update roles set permissions='[\"buyer:supplier:read\"]' where id='ecrole'");
    assertThatThrownBy(() -> detail("uninvoiced",1,10)).isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    assertThatThrownBy(() -> detail("payment-verification",1,10)).isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    jdbc.update("update roles set permissions='[\"buyer:order:read\",\"buyer:invoice:read\"]' where id='ecrole'");
    assertThatThrownBy(() -> detail("uninvoiced",1,10)).isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
  }
}
