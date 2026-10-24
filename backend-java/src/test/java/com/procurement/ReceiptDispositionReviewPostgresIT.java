package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.common.tenant.TenantContext;
import com.procurement.order.api.CreateReceiptDispositionReviewRequest;
import com.procurement.order.application.OrderAccessService;
import com.procurement.order.application.ReceiptDispositionReviewApplicationService;
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
class ReceiptDispositionReviewPostgresIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl); r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword); r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired ReceiptDispositionReviewApplicationService service;
  @MockBean OrderAccessService access;
  @MockBean com.procurement.tenant.application.TenantFeatureApplicationService features;
  @MockBean com.procurement.audit.application.AuditLogApplicationService audit;
  @MockBean com.procurement.common.storage.ObjectStorageService storage;
  String tenant, user, order, receipt, rfq, supplier, role;
  final CreateReceiptDispositionReviewRequest concession = new CreateReceiptDispositionReviewRequest("让步接收", "技术确认可用", "QA-001");

  @BeforeEach void seed() {
    String id = UUID.randomUUID().toString(); tenant = "t-" + id; user = "u-" + id;
    order = "o-" + id; receipt = "r-" + id; rfq = "rfq-" + id; supplier = "s-" + id; role = "role-" + id;
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Review','starter','active')", tenant);
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Reviewer','active')", user, tenant);
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions) values (?,?,'buyer','Reviewer','[\"buyer:receipt:manage\",\"buyer:workflow:review\",\"buyer:receipt:read\"]')", role, tenant);
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)", user, role);
    jdbc.update("insert into enterprises(id,name,type) values (?,'Supplier','supplier')", supplier);
    jdbc.update("insert into rfqs(id,tenant_id,title,status,deadline_at,owner_id) values (?,?,'RFQ','已定标',now(),?)", rfq, tenant, user);
    jdbc.update("insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date) values (?,?,?,?,100,'已收货',current_date)", order, tenant, rfq, supplier);
    jdbc.update("insert into order_line_items(id,tenant_id,order_id,description,quantity,unit_price,line_amount) values (?,?,?,'Item',10,10,100)", "l-" + id, tenant, order);
    jdbc.update("insert into receipts(id,tenant_id,order_id,receiver_id,result,received_quantity,qualified_quantity,inspection_conclusion,disposition) values (?,?,?,?,'部分合格',10,8,'部分合格','退货换货')", receipt, tenant, order, user);
    jdbc.update("insert into receipt_line_items(id,tenant_id,receipt_id,order_line_id,description,ordered_quantity,received_quantity,qualified_quantity) values (?,?,?,?,'Item',10,10,8)", "rl-" + id, tenant, receipt, "l-" + id);
    TenantContext.set(tenant, null, user);
  }
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void reviewIsImmutableAndOriginalRejectedQuantitiesAndDispositionRemainUnchanged() {
    var review = service.create(receipt, concession);
    assertThat(review.reviewedBy()).isEqualTo(user);
    assertThat(review.reviewedAt()).isNotNull();
    assertThat(service.get(receipt).id()).isEqualTo(review.id());
    assertThat(jdbc.queryForObject("select qualified_quantity from receipts where id=?", Integer.class, receipt)).isEqualTo(8);
    assertThat(jdbc.queryForObject("select disposition from receipts where id=?", String.class, receipt)).isEqualTo("退货换货");
    assertThat(jdbc.queryForObject("select qualified_quantity from receipt_line_items where receipt_id=?", Integer.class, receipt)).isEqualTo(8);
    assertThatThrownBy(() -> jdbc.update("update receipt_disposition_reviews set reason='overwrite' where id=?", review.id()))
        .isInstanceOf(org.springframework.dao.DataAccessException.class);
    assertThatThrownBy(() -> jdbc.update("delete from receipt_disposition_reviews where id=?", review.id()))
        .isInstanceOf(org.springframework.dao.DataAccessException.class);
  }

  @Test void concurrentIdenticalReviewsShareOneImmutableIdentity() throws Exception {
    try (var pool = Executors.newFixedThreadPool(2)) {
      var start = new CountDownLatch(1);
      Callable<String> task = () -> { start.await(); TenantContext.set(tenant, null, user);
        try { return service.create(receipt, concession).id(); } finally { TenantContext.clear(); } };
      var first = pool.submit(task); var second = pool.submit(task); start.countDown();
      assertThat(first.get(30, TimeUnit.SECONDS)).isEqualTo(second.get(30, TimeUnit.SECONDS));
      assertThat(jdbc.queryForObject("select count(*) from receipt_disposition_reviews where receipt_id=?", Integer.class, receipt)).isEqualTo(1);
    }
  }

  @Test void paymentOrExecutionArchiveBlocksNewReviewAndPaidRetryDoesNotRewriteOriginal() {
    String invoice = "i-" + UUID.randomUUID();
    jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,payment_status) values (?,?,?,?,100,'已付款')", invoice, tenant, supplier, order);
    assertThatThrownBy(() -> service.create(receipt, concession)).isInstanceOf(IllegalStateException.class);
    jdbc.update("update invoices set payment_status='待付款' where id=?", invoice);
    jdbc.update("insert into procurement_execution_archives(id,tenant_id,rfq_id,snapshot,sha256,created_by,remark,zip_data) values (?,?,?,'{}',?,?,'Archive',decode('00','hex'))",
        "a-" + UUID.randomUUID(), tenant, rfq, "0".repeat(64), user);
    assertThatThrownBy(() -> service.create(receipt, concession)).isInstanceOf(IllegalStateException.class);
    assertThat(jdbc.queryForObject("select count(*) from receipt_disposition_reviews where receipt_id=?", Integer.class, receipt)).isZero();
  }

  @Test void workflowPermissionIsCheckedAgainstRealRolesAndOtherTenantCannotRead() {
    jdbc.update("update roles set permissions='[\"buyer:receipt:manage\"]' where id=?", role);
    assertThatThrownBy(() -> service.create(receipt, concession)).isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    TenantContext.set("another", null, user);
    assertThatThrownBy(() -> service.get(receipt)).isInstanceOf(IllegalArgumentException.class);
  }
}
