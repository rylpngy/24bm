package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.common.tenant.TenantContext;
import com.procurement.order.api.CreatePurchaseOrderRequest;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@org.springframework.test.annotation.DirtiesContext
class AwardOrderIdempotencyPostgresIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl);
    r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword);
    r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired PurchaseOrderApplicationService service;
  @Autowired PurchaseOrderMapper mapper;
  @Autowired PlatformTransactionManager transactions;
  @MockBean com.procurement.common.storage.ObjectStorageService storage;
  @MockBean com.procurement.tenant.application.TenantFeatureApplicationService features;
  String tenant, user, supplier, rfq, quote, award;
  final LocalDate receiptDate = LocalDate.now().plusDays(7);

  @BeforeEach void seed() {
    String suffix = UUID.randomUUID().toString();
    tenant = "ao-" + suffix; user = "u-" + suffix; supplier = "s-" + suffix;
    rfq = "r-" + suffix; quote = "q-" + suffix; award = "a-" + suffix;
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Award order','starter','active')", tenant);
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Buyer','active')", user, tenant);
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions) values (?,?,'buyer','Manager','[\"buyer:*\"]')", "role-" + suffix, tenant);
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)", user, "role-" + suffix);
    jdbc.update("insert into enterprises(id,name,type) values (?,'Supplier','supplier')", supplier);
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level) values (?,?,?,'已准入','A')", "rel-" + suffix, tenant, supplier);
    jdbc.update("insert into rfqs(id,tenant_id,title,status,deadline_at,owner_id,awarded_supplier_id) values (?,?,'Award order','已定标',now(),?,?)", rfq, tenant, user, supplier);
    jdbc.update("insert into quotes(id,tenant_id,rfq_id,supplier_id,amount,tax_rate,delivery_days,status) values (?,?,?,?,100,13,7,'已中选')", quote, tenant, rfq, supplier);
    jdbc.update("insert into quote_line_items(id,tenant_id,quote_id,description,unit,quantity,unit_price,line_amount,sort_no) values (?,?,?,'Real quoted item','item',2,50,100,1)", "ql-" + suffix, tenant, quote);
    jdbc.update("insert into award_decisions(id,tenant_id,rfq_id,quote_id,supplier_id,amount,reason,approved_status) values (?,?,?,?,?,100,'Approved award','已通过')", award, tenant, rfq, quote, supplier);
    TenantContext.set(tenant, null, user);
  }

  @AfterEach void clear() { TenantContext.clear(); }

  private CreatePurchaseOrderRequest request() { return new CreatePurchaseOrderRequest(award, receiptDate); }

  @ParameterizedTest
  @ValueSource(strings = {"竞价", "单一来源"})
  void concurrentNullReadsReturnOneCommittedOrderWithAllLines(String method) throws Exception {
    jdbc.update("update rfqs set method=? where id=?", method, rfq);
    var bothReadNull = new CyclicBarrier(2);
    try (var pool = Executors.newFixedThreadPool(2)) {
      Callable<PurchaseOrderResponse> create = () -> {
        TenantContext.set(tenant, null, user);
        try {
          return new TransactionTemplate(transactions).execute(status -> {
            // Prime the real MyBatis transaction-local cache with a missing source in both transactions.
            assertThat(mapper.findByAwardSource(tenant, rfq, supplier)).isNull();
            try { bothReadNull.await(15, TimeUnit.SECONDS); }
            catch (Exception e) { throw new IllegalStateException("Concurrent readers did not reach the barrier", e); }
            return service.createFromAward(request());
          });
        } finally { TenantContext.clear(); }
      };
      var first = pool.submit(create);
      var second = pool.submit(create);
      PurchaseOrderResponse a = first.get(30, TimeUnit.SECONDS);
      PurchaseOrderResponse b = second.get(30, TimeUnit.SECONDS);
      assertThat(b.id()).isEqualTo(a.id());
      assertThat(b.lineItems()).isEqualTo(a.lineItems()).hasSize(1);
      assertThat(b.lineItems().getFirst().quantity()).isEqualByComparingTo("2");
      assertThat(b.lineItems().getFirst().unitPrice()).isEqualByComparingTo("50");
      assertThat(b.amount()).isEqualByComparingTo("100");
      assertThat(b.sourceMethod()).isEqualTo(method);
      assertThat(b.expectedReceiptDate()).isEqualTo(receiptDate);
    }
    assertOneOrderAndLine();
  }

  @Test void repeatReturnsExistingOrderWithStableLinesAndDoesNotRecreateIt() {
    var first = service.createFromAward(request());
    var repeated = service.createFromAward(new CreatePurchaseOrderRequest(award, receiptDate.plusDays(2)));
    assertThat(repeated.id()).isEqualTo(first.id());
    assertThat(repeated.lineItems()).isEqualTo(first.lineItems());
    assertThat(repeated.expectedReceiptDate()).isEqualTo(receiptDate);
    assertOneOrderAndLine();
  }

  @Test void exitedSupplierStillReturnsItsExistingOrderWithoutChangingItsContents() {
    var first = service.createFromAward(request());
    jdbc.update("update buyer_supplier_relations set status='已退出' where tenant_id=? and supplier_id=?", tenant, supplier);
    var repeated = service.createFromAward(request());
    assertThat(repeated.id()).isEqualTo(first.id());
    assertThat(repeated.lineItems()).isEqualTo(first.lineItems());
    assertOneOrderAndLine();
  }

  @Test void exitedSupplierWithoutAnExistingOrderCannotCreateOne() {
    jdbc.update("update buyer_supplier_relations set status='已退出' where tenant_id=? and supplier_id=?", tenant, supplier);
    assertThatThrownBy(() -> service.createFromAward(request())).hasMessageContaining("供应商未准入");
    assertThat(jdbc.queryForObject("select count(*) from purchase_orders where tenant_id=?", Integer.class, tenant)).isZero();
  }

  private void assertOneOrderAndLine() {
    assertThat(jdbc.queryForObject("select count(*) from purchase_orders where tenant_id=? and rfq_id=? and supplier_id=?", Integer.class, tenant, rfq, supplier)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from order_line_items where tenant_id=?", Integer.class, tenant)).isEqualTo(1);
  }
}
