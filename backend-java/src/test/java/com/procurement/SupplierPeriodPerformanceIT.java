package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.supplier.application.SupplierFulfillmentMetricsService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@Transactional
@DirtiesContext
class SupplierPeriodPerformanceIT {
  @Container
  static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", DB::getJdbcUrl);
    registry.add("spring.datasource.username", DB::getUsername);
    registry.add("spring.datasource.password", DB::getPassword);
    registry.add("keycloak.enabled", () -> false);
    registry.add("app.seed.locations", () -> "");
  }

  @Autowired JdbcTemplate jdbc;
  @Autowired SupplierFulfillmentMetricsService service;
  @Autowired org.mybatis.spring.SqlSessionTemplate sqlSession;

  // JDBC fixture mutations bypass MyBatis; emulate the fresh session of the next HTTP request.
  private void nextRequest() { sqlSession.clearCache(); }

  @BeforeEach
  void seed() {
    jdbc.update("insert into tenants(id,name,plan,status) values ('ppa','A','starter','active'),('ppb','B','starter','active')");
    jdbc.update("insert into enterprises(id,name,type) values ('pps','Supplier','supplier'),('pps2','Unassessed','supplier'),('ppforeign','Foreign','supplier')");
    jdbc.update("insert into users(id,tenant_id,name,status) values ('ppu','ppa','User','active'),('pppeer','ppa','Peer','active'),('ppbu','ppb','Other','active')");
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions,data_scope) values ('ppr','ppa','buyer','Reader','[\"buyer:supplier:read\"]','all')");
    jdbc.update("insert into user_roles(user_id,role_id) values ('ppu','ppr')");
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level) values ('pprel','ppa','pps','已准入','B'),('pprel2','ppa','pps2','待准入','C'),('ppbrel','ppb','ppforeign','黑名单','D')");
    TenantContext.set("ppa", null, "ppu");
  }

  @AfterEach
  void clear() { TenantContext.clear(); }

  private void receipt(String id, String tenant, String supplier, String owner, String registeredAt,
      String expectedDate, int received, int qualified) {
    jdbc.update("insert into rfqs(id,tenant_id,title,status,deadline_at,owner_id) values (?,?,?,'草稿',now(),?)",
        id + "rfq", tenant, id, owner);
    jdbc.update("insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date) values (?,?,?,?,100,'已收货',?::date)",
        id + "order", tenant, id + "rfq", supplier, expectedDate);
    jdbc.update("insert into receipts(id,tenant_id,order_id,receiver_id,result,received_at,received_quantity,qualified_quantity) values (?,?,?,?,'不合格',?::timestamptz,?,?)",
        id, tenant, id + "order", owner, registeredAt, received, qualified);
  }

  private void evaluation(String id, String tenant, String supplier, String period, int score) {
    jdbc.update("""
        insert into supplier_evaluations(id,tenant_id,supplier_id,period,quality_score,delivery_score,
          price_score,service_score,total_score,suggested_tier,comment,evaluated_by)
        values (?,?,?,?,?,?,?,?,?,'合格','评价',?)
        """, id, tenant, supplier, period, score, score, score, score, score,
        tenant.equals("ppa") ? "ppu" : "ppbu");
    nextRequest();
  }

  @Test
  void shanghaiRegistrationBoundariesAndOnTimeIgnoreSessionTimezone() {
    jdbc.execute("set local time zone 'America/Los_Angeles'");
    receipt("before", "ppa", "pps", "ppu", "2001-09-30T15:59:59Z", "2001-09-30", 100, 100);
    receipt("start", "ppa", "pps", "ppu", "2001-09-30T16:00:00Z", "2001-09-30", 10, 0);
    receipt("last", "ppa", "pps", "ppu", "2001-12-31T15:59:59.999999Z", "2001-12-31", 20, 20);
    receipt("next", "ppa", "pps", "ppu", "2001-12-31T16:00:00Z", "2002-01-01", 100, 100);
    var metrics = service.metricsForSupplier("pps", "2001-q4");
    assertThat(metrics.receiptCount()).isEqualTo(2);
    assertThat(metrics.scheduledReceiptCount()).isEqualTo(2);
    assertThat(metrics.onTimeCount()).isEqualTo(1);
    assertThat(metrics.onTimeRate()).isEqualTo(50);
    assertThat(metrics.totalReceived()).isEqualTo(30);
    assertThat(metrics.totalQualified()).isEqualTo(20);
    assertThat(metrics.qualifiedRate()).isEqualTo(67);
    assertThat(service.metricsForSupplier("pps", "2001-10").receiptCount()).isEqualTo(1);
    assertThat(service.metricsForSupplier("pps", "2001").receiptCount()).isEqualTo(3);
    assertThat(service.metricsForSupplier("pps", "2001").onTimeRate()).isEqualTo(67);
    assertThat(service.metricsForSupplier("pps", "2001").qualifiedRate()).isEqualTo(92);
    assertThat(service.metricsForSupplier("pps").receiptCount()).isEqualTo(4);
    var comparison = service.performanceComparison("2001-Q4").getFirst();
    assertThat(comparison.receiptCount()).isEqualTo(metrics.receiptCount());
    assertThat(comparison.onTimeRate()).isEqualTo(metrics.onTimeRate());
    assertThat(comparison.qualifiedRate()).isEqualTo(metrics.qualifiedRate());
  }

  @Test
  void failedInspectionStillContributesAndZeroQuantityIsUnknownRate() {
    receipt("failed", "ppa", "pps", "ppu", "2001-10-01T00:00:00+08:00", "2001-10-01", 10, 0);
    receipt("scheduled", "ppa", "pps", "ppu", "2001-10-02T00:00:00+08:00", "2001-10-02", 10, 10);
    var mixed = service.metricsForSupplier("pps", "2001-Q4");
    assertThat(mixed.onTimeRate()).isEqualTo(100);
    assertThat(mixed.qualifiedRate()).isEqualTo(50);
    assertThat(mixed.receiptCount()).isEqualTo(2);
    assertThat(mixed.scheduledReceiptCount()).isEqualTo(2);
    receipt("empty", "ppa", "pps2", "ppu", "2001-10-01T00:00:00+08:00", "2001-10-01", 0, 0);
    assertThat(service.metricsForSupplier("pps2", "2001-Q4").qualifiedRate()).isNull();
    assertThat(service.metricsForSupplier("pps2", "2001-Q3").onTimeRate()).isNull();
  }

  @Test
  void exactNormalizedPeriodPreservesZeroAndDoesNotUseLatestOrAverageQuarters() {
    evaluation("zero", "ppa", "pps", "\t2001-q4\n", 0);
    evaluation("latest", "ppa", "pps", "2002-Q1", 99);
    evaluation("other-period", "ppa", "pps2", "2001-Q3", 80);
    evaluation("foreign-score", "ppb", "pps2", "2001-Q4", 90);
    var rows = service.performanceComparison("2001-q4");
    assertThat(rows).hasSize(2);
    var zero = rows.stream().filter(r -> r.supplierId().equals("pps")).findFirst().orElseThrow();
    assertThat(zero.relationId()).isEqualTo("pprel");
    assertThat(zero.supplierName()).isEqualTo("Supplier");
    assertThat(zero.status()).isEqualTo("已准入");
    assertThat(zero.level()).isEqualTo("B");
    assertThat(zero.evaluationId()).isEqualTo("zero");
    assertThat(zero.qualityScore()).isZero();
    assertThat(zero.deliveryScore()).isZero();
    assertThat(zero.priceScore()).isZero();
    assertThat(zero.serviceScore()).isZero();
    assertThat(zero.totalScore()).isZero();
    assertThat(zero.evaluatedAt()).isNotNull();
    var empty = rows.stream().filter(r -> r.supplierId().equals("pps2")).findFirst().orElseThrow();
    assertThat(empty.evaluationId()).isNull();
    assertThat(empty.totalScore()).isNull();
    assertThat(empty.evaluatedAt()).isNull();
    assertThat(empty.receiptCount()).isZero();
    assertThat(empty.onTimeRate()).isNull();
    assertThat(service.performanceComparison("2001")).allSatisfy(r -> assertThat(r.evaluationId()).isNull());
    evaluation("year", "ppa", "pps", "2001", 42);
    assertThat(service.performanceComparison("2001").getFirst().totalScore()).isEqualByComparingTo("42");
  }

  @Test
  void tenantAndSelfScopeFilterBothPeriodAndCumulativeMetrics() {
    receipt("own", "ppa", "pps", "ppu", "2001-10-01T00:00:00+08:00", "2001-10-01", 10, 10);
    receipt("peer", "ppa", "pps", "pppeer", "2001-10-01T00:00:00+08:00", "2001-10-01", 100, 100);
    receipt("foreign", "ppb", "pps", "ppbu", "2001-10-01T00:00:00+08:00", "2001-10-01", 1000, 1000);
    jdbc.update("update roles set data_scope='self' where id='ppr'");
    assertThat(service.metricsForSupplier("pps").totalReceived()).isEqualTo(10);
    assertThat(service.metricsForSupplier("pps", "2001-Q4").totalReceived()).isEqualTo(10);
    assertThat(service.performanceComparison("2001-Q4").getFirst().totalReceived()).isEqualTo(10);
    assertThat(service.performanceComparison("2001-Q4")).extracting(r -> r.supplierId()).doesNotContain("ppforeign");
    assertThatThrownBy(() -> service.metricsForSupplier("ppforeign")).isInstanceOf(IllegalArgumentException.class);
    jdbc.update("update roles set data_scope='all' where id='ppr'");
    nextRequest();
    assertThat(service.metricsForSupplier("pps").totalReceived()).isEqualTo(110);
  }

  @Test
  void departmentScopeRequiresEveryLinkedDemandAndEmptyScopeDeniesAllMetrics() {
    receipt("department", "ppa", "pps", "ppu", "2001-10-01T00:00:00+08:00", "2001-10-01", 10, 10);
    jdbc.update("update roles set data_scope='department' where id='ppr'");
    assertThat(service.metricsForSupplier("pps").receiptCount()).isZero();
    assertThat(service.performanceComparison("2001-Q4")).allSatisfy(r -> assertThat(r.receiptCount()).isZero());
    jdbc.update("insert into departments(id,tenant_id,name) values ('ppd','ppa','Own'),('ppd2','ppa','Other')");
    jdbc.update("update users set department_id='ppd' where id='ppu'");
    jdbc.update("insert into purchase_demands(id,tenant_id,title,department_id,requester_id,budget,status) values ('ppdem','ppa','Own','ppd','ppu',100,'草稿'),('ppdem2','ppa','Other','ppd2','pppeer',100,'草稿')");
    jdbc.update("insert into rfq_demands(id,tenant_id,rfq_id,demand_id) values ('pprd','ppa','departmentrfq','ppdem')");
    nextRequest();
    assertThat(service.metricsForSupplier("pps").receiptCount()).isEqualTo(1);
    assertThat(service.performanceComparison("2001-Q4").getFirst().receiptCount()).isEqualTo(1);
    jdbc.update("insert into rfq_demands(id,tenant_id,rfq_id,demand_id) values ('pprd2','ppa','departmentrfq','ppdem2')");
    nextRequest();
    assertThat(service.metricsForSupplier("pps").receiptCount()).isZero();
    assertThat(service.performanceComparison("2001-Q4").getFirst().receiptCount()).isZero();
  }

  @Test
  void overdueUnregisteredOrdersAreNotReceiptSamples() {
    jdbc.update("insert into rfqs(id,tenant_id,title,status,deadline_at,owner_id) values ('overdue','ppa','Overdue','草稿',now(),'ppu')");
    jdbc.update("insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date) values ('overdue','ppa','overdue','pps',100,'待发货','2001-01-01')");
    var metrics = service.metricsForSupplier("pps", "2001");
    assertThat(metrics.receiptCount()).isZero();
    assertThat(metrics.scheduledReceiptCount()).isZero();
    assertThat(metrics.onTimeRate()).isNull();
    assertThat(service.performanceComparison("2001").getFirst().onTimeRate()).isNull();
  }

  @Test
  void directServiceCallsRequireSupplierReadAndRejectExplicitEmptyPeriod() {
    assertThatThrownBy(() -> service.metricsForSupplier("pps", "")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.performanceComparison(null)).isInstanceOf(IllegalArgumentException.class);
    jdbc.update("update roles set permissions='[\"buyer:order:read\"]' where id='ppr'");
    nextRequest();
    assertThatThrownBy(() -> service.metricsForSupplier("pps")).isInstanceOf(PermissionDeniedException.class);
    assertThatThrownBy(() -> service.performanceComparison("2001-Q4")).isInstanceOf(PermissionDeniedException.class);
  }
}
