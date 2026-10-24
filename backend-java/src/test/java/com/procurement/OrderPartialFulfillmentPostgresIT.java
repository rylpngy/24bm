package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.common.tenant.TenantContext;
import com.procurement.order.api.*;
import com.procurement.order.application.*;
import java.math.BigDecimal;
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
class OrderPartialFulfillmentPostgresIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl);
    r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword);
    r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired DeliveryApplicationService deliveries;
  @Autowired ReceiptApplicationService receipts;
  @MockBean OrderAccessService access;
  @MockBean com.procurement.tenant.application.TenantFeatureApplicationService features;
  @MockBean com.procurement.audit.application.AuditLogApplicationService audit;
  @MockBean com.procurement.notification.application.NotificationApplicationService notifications;
  @MockBean com.procurement.common.storage.ObjectStorageService storage;
  String tenant, supplier, user, order, line;

  @BeforeEach void seed() {
    String id = UUID.randomUUID().toString();
    tenant = "t-" + id; supplier = "s-" + id; user = "u-" + id; order = "o-" + id; line = "l-" + id;
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Fulfillment','starter','active')", tenant);
    jdbc.update("insert into enterprises(id,name,type) values (?,'Supplier','supplier')", supplier);
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Buyer','active')", user, tenant);
    jdbc.update("insert into rfqs(id,tenant_id,title,status,deadline_at,owner_id) values (?,?,'RFQ','已定标',now(),?)", "r-" + id, tenant, user);
    jdbc.update("insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date) values (?,?,?,?,100,'待发货',current_date)", order, tenant, "r-" + id, supplier);
    jdbc.update("insert into order_line_items(id,tenant_id,order_id,description,quantity,unit_price,line_amount) values (?,?,?,'Item',10,10,100)", line, tenant, order);
  }
  @AfterEach void clear() { TenantContext.clear(); }
  BigDecimal n(int value) { return BigDecimal.valueOf(value); }
  CreateDeliveryRequest shipment(int quantity) {
    return new CreateDeliveryRequest("Carrier", "Tracking", quantity, null, null, null,
        List.of(new DeliveryLineItemRequest(line, n(quantity))));
  }
  CreateReceiptRequest receipt(int received, int qualified) {
    return new CreateReceiptRequest("Inspection", received, qualified, "",
        List.of(new ReceiptLineItemRequest(line, n(received), n(qualified))),
        received == qualified ? null : "让步接收", "");
  }
  DeliveryResponse ship(int quantity) {
    TenantContext.set(null, supplier, user); return deliveries.create(order, shipment(quantity));
  }
  ReceiptResponse receive(int received, int qualified) {
    TenantContext.set(tenant, null, user); return receipts.create(order, receipt(received, qualified));
  }
  String status() { return jdbc.queryForObject("select status from purchase_orders where id=?", String.class, order); }

  @Test void multipleBatchesPreserveHistoryAndOnlyFullQuantityClosesOrder() {
    var first = ship(4);
    receive(2, 1);
    assertThat(status()).isEqualTo("已发货");
    ship(6); receive(3, 3);
    assertThat(status()).isEqualTo("已发货");
    receive(5, 5);
    assertThat(status()).isEqualTo("已收货");
    assertThat(jdbc.queryForObject("select count(*) from receipts where order_id=?", Integer.class, order)).isEqualTo(3);
    assertThat(jdbc.queryForObject("select shipped_quantity from deliveries where id=?", Integer.class, first.id())).isEqualTo(4);
    assertThatThrownBy(() -> ship(1)).isInstanceOf(IllegalStateException.class);
  }

  @Test void rejectsInvalidLinesTotalsOverrunsAndQuantityEditsWithoutWritingDocuments() {
    TenantContext.set(null, supplier, user);
    var duplicate = new DeliveryLineItemRequest(line, n(2));
    assertThatThrownBy(() -> deliveries.create(order, new CreateDeliveryRequest("C", "T", 4, null, null, null,
        List.of(duplicate, duplicate)))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> deliveries.create(order, new CreateDeliveryRequest("C", "T", 2, null, null, null,
        List.of(new DeliveryLineItemRequest(line, n(3)))))).isInstanceOf(IllegalArgumentException.class);
    for (int invalid : new int[] {0, -1, 11}) assertThatThrownBy(() -> ship(invalid)).isInstanceOf(IllegalArgumentException.class);
    var first = ship(4);
    assertThatThrownBy(() -> deliveries.update(first.id(), new UpdateDeliveryRequest("C", "T", 3, null, null, null)))
        .isInstanceOf(IllegalArgumentException.class);
    TenantContext.set(tenant, null, user);
    var r = new ReceiptLineItemRequest(line, n(1), n(1));
    assertThatThrownBy(() -> receipts.create(order, new CreateReceiptRequest("R", 2, 2, null, List.of(r, r), null, null)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> receipts.create(order, new CreateReceiptRequest("R", 3, 3, null, List.of(r), null, null)))
        .isInstanceOf(IllegalArgumentException.class);
    for (int[] invalid : new int[][] {{0,0}, {-1,0}, {2,3}, {2,-1}, {5,5}})
      assertThatThrownBy(() -> receive(invalid[0], invalid[1])).isInstanceOf(IllegalArgumentException.class);
    receive(3,3);
    assertThatThrownBy(() -> receive(2,2)).isInstanceOf(IllegalArgumentException.class);
    assertThat(jdbc.queryForObject("select count(*) from receipts where order_id=?", Integer.class, order)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from deliveries where order_id=?", Integer.class, order)).isEqualTo(1);
  }

  @Test void concurrentShipmentsCannotBothConsumeTheSameRemainingCapacity() throws Exception {
    assertThat(race(() -> ship(6))).isEqualTo(1);
    assertThat(jdbc.queryForObject("select sum(shipped_quantity) from deliveries where order_id=?", Integer.class, order)).isEqualTo(6);
  }

  @Test void fullUnambiguousHeadersMapKnownRemainingLinesButPartialHeadersDoNot() {
    TenantContext.set(null, supplier, user);
    assertThatThrownBy(() -> deliveries.create(order, new CreateDeliveryRequest("C", "T", 4, null, null, null)))
        .isInstanceOf(IllegalArgumentException.class);
    deliveries.create(order, new CreateDeliveryRequest("C", "T", 10, null, null, null));
    TenantContext.set(tenant, null, user);
    assertThatThrownBy(() -> receipts.create(order, new CreateReceiptRequest("R", 10, 9, null, null, "退货换货", null)))
        .isInstanceOf(IllegalArgumentException.class);
    receipts.create(order, new CreateReceiptRequest("R", 10, 10, null, null, null, null));
    assertThat(status()).isEqualTo("已收货");
    assertThat(jdbc.queryForObject("select count(*) from delivery_line_items where tenant_id=?", Integer.class, tenant)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from receipt_line_items where tenant_id=?", Integer.class, tenant)).isEqualTo(1);
  }

  @Test void concurrentReceiptsCannotBothConsumeTheSameRemainingCapacity() throws Exception {
    ship(10);
    assertThat(race(() -> receive(6,6))).isEqualTo(1);
    assertThat(jdbc.queryForObject("select sum(received_quantity) from receipts where order_id=?", Integer.class, order)).isEqualTo(6);
    assertThat(status()).isEqualTo("已发货");
  }

  @Test void legacyHeadersAreNotBackfilledOrTreatedAsAvailableLineCapacity() {
    var first = ship(4);
    jdbc.update("delete from delivery_line_items where delivery_id=?", first.id());
    assertThatThrownBy(() -> ship(1)).isInstanceOf(IllegalStateException.class).hasMessageContaining("manual reconciliation");
    assertThatThrownBy(() -> receive(1,1)).isInstanceOf(IllegalStateException.class).hasMessageContaining("manual reconciliation");
    assertThat(jdbc.queryForObject("select shipped_quantity from deliveries where id=?", Integer.class, first.id())).isEqualTo(4);
  }

  int race(Runnable operation) throws Exception {
    try (var pool = Executors.newFixedThreadPool(2)) {
      var start = new CountDownLatch(1);
      Callable<Integer> task = () -> { start.await(); try { operation.run(); return 1; }
        catch (IllegalArgumentException | IllegalStateException rejected) { return 0; }
        finally { TenantContext.clear(); } };
      var first = pool.submit(task); var second = pool.submit(task); start.countDown();
      return first.get(30, TimeUnit.SECONDS) + second.get(30, TimeUnit.SECONDS);
    }
  }
}
