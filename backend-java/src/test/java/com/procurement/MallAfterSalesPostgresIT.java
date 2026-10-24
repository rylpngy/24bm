package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.procurement.mall.domain.MallAfterSalesPolicy;
import com.procurement.mall.infrastructure.MallServiceMapper;
import com.procurement.mall.application.MallServiceApplicationService;
import com.procurement.mall.api.CreateAfterSalesRequest;
import com.procurement.mall.api.HandleAfterSalesRequest;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.application.OrderAccessService;
import com.procurement.order.application.PurchaseOrderQueryService;
import com.procurement.finance.application.PaymentAuthorizationService;
import com.procurement.finance.application.PaymentLedgerApplicationService;
import com.procurement.finance.application.PaymentApplicationService;
import com.procurement.finance.api.RecordPaymentAmountRequest;
import com.procurement.finance.application.FinanceAccessService;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.ThreeWayMatchMapper;
import com.procurement.finance.infrastructure.PaymentRequestMapper;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.finance.infrastructure.PaymentEntryMapper;
import com.procurement.finance.infrastructure.PaymentExecutionRecordMapper;
import com.procurement.finance.domain.PaymentRequest;
import com.procurement.finance.domain.PaymentBatchStatus;
import com.procurement.contract.application.ContractApplicationService;
import com.procurement.contract.application.ContractAccessService;
import com.procurement.contract.application.ContractPaymentPolicyService;
import com.procurement.contract.application.ContractInstallmentService;
import com.procurement.contract.api.UpdateContractArchiveStatusRequest;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.UUID;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.LocalCacheScope;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.junit.jupiter.Testcontainers;

// Re-run the existing V220 regression suite under the V225 wrapper as well.
@Testcontainers
class MallAfterSalesPostgresIT extends ContractFinanceCloseoutPostgresIT {
  @BeforeAll static void boundAllFixtureConnections() throws Exception {
    var properties = new java.util.Properties();
    properties.setProperty("user", DB.getUsername());
    properties.setProperty("password", DB.getPassword());
    properties.setProperty("options", "-c lock_timeout=5000 -c statement_timeout=15000");
    try (var connection = DriverManager.getConnection(DB.getJdbcUrl(), properties);
         var statement = connection.createStatement()) {
      String database = '"' + DB.getDatabaseName().replace("\"", "\"\"") + '"';
      statement.execute("alter database " + database + " set lock_timeout='5s'");
      statement.execute("alter database " + database + " set statement_timeout='15s'");
      statement.execute("alter database " + database + " set idle_in_transaction_session_timeout='30s'");
    }
  }

  private void execute(String sql) throws Exception {
    try (Connection c = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
         var statement = c.createStatement()) { statement.execute(sql); }
  }

  private String blocker(String view) throws Exception {
    try (Connection c = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
         var statement = c.createStatement();
         var rows = statement.executeQuery("select blocking_reason from " + view + " where tenant_id='t'")) {
      assertThat(rows.next()).isTrue();
      return rows.getString(1);
    }
  }

  @Override @BeforeEach void seed() throws Exception {
    super.seed();
    execute("""
        create table enterprises(id text primary key,name text);
        insert into enterprises values ('s','Supplier');
        create table mall_after_sales (
          id text primary key,tenant_id text,order_id text,order_line_id text,supplier_id text,
          type text,quantity numeric(14,2),reason text,status text,supplier_reply text,
          created_at timestamptz default now(),updated_at timestamptz default now());
        create table mall_products(id text primary key);
        create table mall_skus(id text primary key,product_id text references mall_products(id));
        alter table order_line_items add column source_sku_id text references mall_skus(id);
        insert into mall_products values ('actual-product');
        insert into mall_skus values ('sku','actual-product');
        update order_line_items set source_sku_id='sku';
        alter table invoices add column invoice_no text, add column reconciliation_note text,
          add column created_at timestamptz default now(), add column updated_at timestamptz default now(),
          add column invoice_code text, add column invoice_date date, add column tax_rate numeric;
        alter table contracts add column contract_no text, add column contract_name text,
          add column archive_status text default '未归档', add column fulfillment_progress text,
          add column effective_date date, add column created_at timestamptz default now(),
          add column updated_at timestamptz default now(), add column sign_date date,
          add column expiry_date date, add column payment_terms text, add column warranty_terms text,
          add column renewal_status text;
        """);
    execute(Files.readString(Path.of("src/main/resources/db/migration/V225__mall_after_sales_lifecycle.sql")));
  }

  private SqlSessionFactory sessions() {
    var source = new UnpooledDataSource("org.postgresql.Driver", DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    var properties = new java.util.Properties();
    properties.setProperty("options", "-c lock_timeout=5000 -c statement_timeout=15000 -c idle_in_transaction_session_timeout=30000");
    source.setDriverProperties(properties);
    var config = new Configuration(new Environment("test", new JdbcTransactionFactory(), source));
    config.setMapUnderscoreToCamelCase(true);
    config.setLocalCacheScope(LocalCacheScope.SESSION);
    config.addMapper(MallServiceMapper.class);
    config.addMapper(InvoiceMapper.class);
    config.addMapper(ThreeWayMatchMapper.class);
    config.addMapper(ContractMapper.class);
    return new SqlSessionFactoryBuilder().build(config);
  }

  @Test void unresolvedClaimsBlockPaymentAndArchiveAndClosedReturnsStayPending() throws Exception {
    assertThat(blocker("finance_invoice_closeout_checks")).isNull();
    execute("insert into mall_after_sales(id,tenant_id,order_id,order_line_id,supplier_id,type,quantity,status) values ('a','t','o','l','s','退货',1,'待处理')");
    assertThat(blocker("finance_invoice_closeout_checks")).contains("售后未决");
    assertThat(blocker("contract_closeout_checks")).contains("售后未决");
    execute("update mall_after_sales set status='待买方确认'");
    assertThat(blocker("contract_closeout_checks")).contains("售后未决");
    execute("update mall_after_sales set status='已完成'");
    assertThat(blocker("finance_invoice_closeout_checks")).contains("财务差异待核对");
    assertThat(blocker("contract_closeout_checks")).contains("财务差异待核对");
    execute("update mall_after_sales set type='维修'");
    assertThat(blocker("finance_invoice_closeout_checks")).isNull();
  }

  @Test void releasedClaimsDoNotConsumeQuantityOrCrossTenantFinancialScope() throws Exception {
    execute("""
        insert into mall_after_sales(id,tenant_id,order_id,order_line_id,supplier_id,type,quantity,status) values
          ('a','t','o','l','s','退货',3,'已拒绝'),
          ('b','t','o','l','s','退货',3,'已撤回'),
          ('c','foreign','o','l','s','退货',3,'待处理'),
          ('d','t','o','l','s','维修',2,'已完成');
        """);
    try (var session = sessions().openSession()) {
      assertThat(session.getMapper(MallServiceMapper.class).claimedQuantity("t", "l")).isEqualByComparingTo("2");
    }
    assertThat(blocker("finance_invoice_closeout_checks")).isNull();
    assertThat(blocker("contract_closeout_checks")).isNull();
  }

  @Test void sourceProductIsTakenFromExactTenantOrderAndLine() {
    try (var session = sessions().openSession()) {
      var mapper = session.getMapper(MallServiceMapper.class);
      assertThat(mapper.sourceProduct("t", "o", "l")).isEqualTo("actual-product");
      assertThat(mapper.sourceProduct("foreign", "o", "l")).isNull();
      assertThat(mapper.sourceProduct("t", "foreign-order", "l")).isNull();
    }
  }

  @Test void historyKeepsEvidenceAndBuyerTransitionUsesExpectedStatus() {
    try (var session = sessions().openSession(false)) {
      var mapper = session.getMapper(MallServiceMapper.class);
      mapper.lockOrder("t", "o");
      mapper.insertAfterSales("a", "t", "o", "l", "s", "维修", BigDecimal.ONE, "破损");
      mapper.insertEvent("event-1", "a", "buyer", "buyer", null, "待处理", "破损", null);
      assertThat(mapper.findForBuyer("t", "a").status()).isEqualTo("待处理");
      assertThat(mapper.findForBuyer("foreign", "a")).isNull();
      assertThat(mapper.findForSupplier("foreign", "a")).isNull();
      mapper.handleBySupplier("a", "s", "处理中", "维修受理", "待处理");
      mapper.insertEvent("event-2", "a", "supplier", "supplier", "待处理", "处理中", "维修受理", null);
      mapper.handleBySupplier("a", "s", "待买方确认", "维修完毕", "处理中");
      mapper.insertEvent("event-3", "a", "supplier", "supplier", "处理中", "待买方确认", "维修完毕", "REPAIR-001");
      assertThat(mapper.buyerTransition("t", "a", "待处理", "已撤回")).isZero();
      assertThat(mapper.buyerTransition("t", "a", "待买方确认", "已完成")).isEqualTo(1);
      var history = mapper.history("t", null, "a");
      assertThat(mapper.history(null, "s", "a")).hasSize(3);
      assertThat(mapper.history("other-tenant", null, "a")).isEmpty();
      assertThat(mapper.history(null, "other-supplier", "a")).isEmpty();
      assertThat(mapper.history(null, null, "a")).isEmpty();
      assertThat(history).hasSize(3);
      assertThat(history.getLast().evidenceNo()).isEqualTo("REPAIR-001");
      assertThat(history.getLast().actorRole()).isEqualTo("supplier");
      session.commit(true);
    }
  }

  @Test void concurrentClaimsCannotOverbookSameLine() throws Exception {
    SqlSessionFactory factory = sessions();
    CountDownLatch start = new CountDownLatch(1);
    try (var workers = Executors.newFixedThreadPool(2)) {
      var first = workers.submit(() -> claim(factory, start, "one"));
      var second = workers.submit(() -> claim(factory, start, "two"));
      start.countDown();
      assertThat((first.get(15, TimeUnit.SECONDS) ? 1 : 0) + (second.get(15, TimeUnit.SECONDS) ? 1 : 0)).isEqualTo(1);
    }
    try (var session = factory.openSession()) {
      assertThat(session.getMapper(MallServiceMapper.class).claimedQuantity("t", "l")).isEqualByComparingTo("6");
    }
  }

  private boolean claim(SqlSessionFactory factory, CountDownLatch start, String id) throws Exception {
    if (!start.await(5, TimeUnit.SECONDS)) throw new AssertionError("Concurrent claim did not start");
    try (var session = factory.openSession(false)) {
      try {
        var mapper = session.getMapper(MallServiceMapper.class);
        assertThat(mapper.lockOrder("t", "o")).isEqualTo("o");
        try {
          MallAfterSalesPolicy.requireCumulativeQuantity(BigDecimal.TEN, mapper.claimedQuantity("t", "l"), new BigDecimal("6"));
        } catch (IllegalStateException limit) {
          return false;
        }
        mapper.insertAfterSales(id, "t", "o", "l", "s", "维修", new BigDecimal("6"), "破损");
        session.commit(true); return true;
      } finally { session.rollback(true); }
    }
  }

  private MallServiceApplicationService service(SqlSession session) {
    var orders = mock(PurchaseOrderQueryService.class);
    when(orders.findLineForTenant("t", "o", "l")).thenReturn(
        new PurchaseOrderQueryService.OrderLineView("o", "l", "已收货", "s", "商品", BigDecimal.TEN));
    var access = mock(OrderAccessService.class);
    when(access.visibleOrders(org.mockito.ArgumentMatchers.anyString())).thenReturn(id -> true);
    return new MallServiceApplicationService(session.getMapper(MallServiceMapper.class), orders,
        mock(AuditLogApplicationService.class), mock(NotificationApplicationService.class), access);
  }

  private void awaitDatabaseLock(String name) throws Exception {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(8);
    while (System.nanoTime() < deadline) {
      try (var c = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
           var query = c.prepareStatement("select exists(select 1 from pg_stat_activity where application_name=? and wait_event_type='Lock')")) {
        query.setString(1, name);
        try (var rows = query.executeQuery()) { rows.next(); if (rows.getBoolean(1)) return; }
      }
      Thread.sleep(20);
    }
    throw new AssertionError("No PostgreSQL lock wait observed: " + name);
  }

  private void childRowIsNotLocked(String table) throws Exception {
    try (var c = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
         var query = c.createStatement()) {
      query.executeQuery("select id from " + table + " where tenant_id='t' for update nowait").close();
    }
  }

  @Test void supplierCannotResurrectWithdrawnCaseFromSessionCache() throws Exception {
    var factory = sessions();
    try (var supplier = factory.openSession(false); var buyer = factory.openSession(false)) {
      var supplierMapper = supplier.getMapper(MallServiceMapper.class);
      var buyerMapper = buyer.getMapper(MallServiceMapper.class);
      buyerMapper.insertAfterSales("a", "t", "o", "l", "s", "维修", BigDecimal.ONE, "破损");
      buyer.commit(true);
      var cached = supplierMapper.findForSupplier("s", "a");
      assertThat(supplierMapper.findForSupplier("s", "a")).isSameAs(cached);
      buyerMapper.lockOrder("t", "o");
      assertThat(buyerMapper.buyerTransition("t", "a", "待处理", "已撤回")).isEqualTo(1);
      String name = "mall-stale-" + UUID.randomUUID();
      supplier.getConnection().setClientInfo("ApplicationName", name);
      var supplierService = service(supplier);
      try (var workers = Executors.newSingleThreadExecutor()) {
        var handling = workers.submit(() -> {
          TenantContext.set(null, "s", "supplier");
          try {
            supplierService.handleAfterSales("a", new HandleAfterSalesRequest("处理中", "受理"));
            supplier.commit(true); return "unexpected success";
          } catch (IllegalStateException expected) {
            return expected.getMessage();
          } finally { TenantContext.clear(); supplier.rollback(true); }
        });
        try {
          awaitDatabaseLock(name);
          buyer.commit(true);
          assertThat(handling.get(15, TimeUnit.SECONDS)).contains("已撤回");
        } finally { buyer.rollback(true); }
      }
      try {
        assertThat(buyerMapper.lockForBuyer("t", "a").status()).isEqualTo("已撤回");
        assertThat(buyerMapper.handleBySupplier("a", "s", "处理中", "stale", "待处理")).isZero();
      } finally { buyer.rollback(true); }
    }
  }

  @Test void buyerCannotWithdrawProcessingCaseFromSessionCache() throws Exception {
    var factory = sessions();
    try (var buyer = factory.openSession(false); var supplier = factory.openSession(false)) {
      var mapper = supplier.getMapper(MallServiceMapper.class);
      mapper.insertAfterSales("a", "t", "o", "l", "s", "维修", BigDecimal.ONE, "破损");
      supplier.commit(true);
      assertThat(buyer.getMapper(MallServiceMapper.class).findForBuyer("t", "a").status()).isEqualTo("待处理");
      mapper.lockOrder("t", "o");
      mapper.handleBySupplier("a", "s", "处理中", "受理", "待处理");
      supplier.commit(true);
      TenantContext.set("t", null, "buyer");
      try {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service(buyer).buyerAction("a", "withdraw", "撤回"))
            .isInstanceOf(IllegalStateException.class);
      } finally { TenantContext.clear(); buyer.rollback(true); }
      try {
        assertThat(mapper.lockForSupplier("s", "a").status()).isEqualTo("处理中");
      } finally { supplier.rollback(true); }
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void paymentWaitsForAfterSalesCommitThenReadsFreshBlocker(boolean legacyStatusEntry) throws Exception {
    var factory = sessions();
    try (var writer = factory.openSession(false); var payment = factory.openSession(false)) {
      var invoices = payment.getMapper(InvoiceMapper.class);
      var matches = payment.getMapper(ThreeWayMatchMapper.class);
      var invoice = invoices.findByTenantAndId("t", "i");
      assertThat(matches.paymentBlockingReason("t", "i")).isNull();
      var requests = mock(PaymentRequestMapper.class);
      var request = new PaymentRequest("pr", "t", "i", "s", "o", new BigDecimal("100"),
          "付款申请已通过", "batch", "测试付款", "buyer", null, null);
      when(requests.lockByTenantAndInvoice("t", "i")).thenReturn(request);
      var batches = mock(PaymentBatchMapper.class);
      when(batches.lockStatus("t", "batch")).thenReturn(PaymentBatchStatus.READY_FOR_PAYMENT);
      var entries = mock(PaymentEntryMapper.class);
      when(entries.balance("t", "i")).thenReturn(new BigDecimal("100"));
      var authorization = new PaymentAuthorizationService(requests, batches, mock(PaymentExecutionRecordMapper.class),
          matches, mock(FinanceAccessService.class), mock(ContractPaymentPolicyService.class), invoices,
          entries, mock(ContractInstallmentService.class));
      var ledger = new PaymentLedgerApplicationService(invoices, entries, mock(FinanceAccessService.class),
          authorization, mock(PaymentApplicationService.class), mock(ContractInstallmentService.class),
          mock(PaymentExecutionRecordMapper.class), mock(AuditLogApplicationService.class));
      String name = "mall-pay-" + UUID.randomUUID();
      payment.getConnection().setClientInfo("ApplicationName", name);
      TenantContext.set("t", null, "buyer");
      try { service(writer).applyAfterSales(new CreateAfterSalesRequest("o", "l", "维修", BigDecimal.ONE, "破损")); }
      finally { TenantContext.clear(); }
      try (var workers = Executors.newSingleThreadExecutor()) {
        var paying = workers.submit(() -> {
          TenantContext.set("t", null, "buyer");
          try {
            if (legacyStatusEntry) authorization.requireReady(invoice, "已付款");
            else ledger.record("i", new RecordPaymentAmountRequest("key-2", BigDecimal.ONE, null, "PAY-2", "付款"));
            return "unexpected success";
          }
          catch (IllegalStateException blocked) { return blocked.getMessage(); }
          finally { TenantContext.clear(); payment.rollback(true); }
        });
        try {
          awaitDatabaseLock(name);
          childRowIsNotLocked("invoices");
          writer.commit(true);
          assertThat(paying.get(15, TimeUnit.SECONDS)).contains("售后未决");
        } finally { writer.rollback(true); }
      }
      verify(entries, never()).insert(org.mockito.ArgumentMatchers.any());
    }
  }

  @Test void archiveWaitsForAfterSalesCommitThenReadsFreshBlocker() throws Exception {
    var factory = sessions();
    try (var writer = factory.openSession(false); var archive = factory.openSession(false)) {
      var contracts = archive.getMapper(ContractMapper.class);
      assertThat(contracts.countArchiveBlockers("t", "c")).isZero();
      assertThat(contracts.findByTenantAndId("t", "c").archiveStatus()).isEqualTo("未归档");
      var application = new ContractApplicationService(contracts, mock(PurchaseOrderMapper.class));
      ReflectionTestUtils.setField(application, "contractAccess", mock(ContractAccessService.class));
      String name = "mall-archive-" + UUID.randomUUID();
      archive.getConnection().setClientInfo("ApplicationName", name);
      TenantContext.set("t", null, "buyer");
      try { service(writer).applyAfterSales(new CreateAfterSalesRequest("o", "l", "维修", BigDecimal.ONE, "破损")); }
      finally { TenantContext.clear(); }
      try (var workers = Executors.newSingleThreadExecutor()) {
        var archiving = workers.submit(() -> {
          TenantContext.set("t", null, "buyer");
          try { application.updateCurrentTenantContractArchiveStatus("c", new UpdateContractArchiveStatusRequest("已归档")); return "unexpected success"; }
          catch (IllegalStateException blocked) { return blocked.getMessage(); }
          finally { TenantContext.clear(); archive.rollback(true); }
        });
        try {
          awaitDatabaseLock(name);
          childRowIsNotLocked("contracts");
          writer.commit(true);
          assertThat(archiving.get(15, TimeUnit.SECONDS)).contains("售后未决");
        } finally { writer.rollback(true); }
      }
      assertThat(contracts.findByTenantAndId("t", "c").archiveStatus()).isEqualTo("未归档");
    }
  }
}
