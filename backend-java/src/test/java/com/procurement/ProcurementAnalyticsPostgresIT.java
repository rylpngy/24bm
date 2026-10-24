package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.mockito.AdditionalAnswers.delegatesTo;

import com.procurement.buyer.application.BuyerAnalyticsApplicationService;
import com.procurement.buyer.application.BuyerAnalyticsReportQuery;
import com.procurement.finance.application.FinanceAccessService;
import com.procurement.finance.application.FinanceReportApplicationService;
import com.zaxxer.hikari.HikariDataSource;
import com.procurement.buyer.domain.ProcurementAnalyticsFilter;
import com.procurement.buyer.infrastructure.BuyerAnalyticsMapper;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.*;
import com.procurement.identity.domain.DataScope;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.datasource.pooled.PooledDataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.*;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.transaction.SpringManagedTransactionFactory;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.junit.jupiter.api.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@Testcontainers
class ProcurementAnalyticsPostgresIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  PooledDataSource source;
  BuyerAnalyticsMapper mapper;
  DataScopeService scopes;
  PermissionService permissions;
  final LocalDate from = LocalDate.parse("2026-01-01"), to = LocalDate.parse("2026-03-31");

  @BeforeEach void seed() throws Exception {
    source = new PooledDataSource("org.postgresql.Driver", DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    try (var connection = source.getConnection(); var s = connection.createStatement()) {
      s.execute("""
          drop schema public cascade; create schema public;
          create table enterprises(id text primary key,name text);
          create table users(id text,tenant_id text,department_id text);
          create table rfqs(id text primary key,tenant_id text,owner_id text,method text,status text,awarded_supplier_id text,current_round int);
          create table purchase_demands(id text primary key,tenant_id text,requester_id text,department_id text,status text,created_at timestamptz);
          create table rfq_demands(tenant_id text,rfq_id text,demand_id text);
          create table purchase_orders(id text primary key,tenant_id text,rfq_id text,supplier_id text,amount numeric(14,2),status text,created_at timestamptz);
          create table quotes(id text primary key,tenant_id text,rfq_id text,supplier_id text,round int,status text,amount numeric(14,2));
          create table award_decisions(id text primary key,tenant_id text,rfq_id text,quote_id text,supplier_id text,amount numeric(14,2),approved_status text,created_at timestamptz);
          create table materials(id text primary key,tenant_id text,category text,reference_price numeric);
          create table purchase_demand_items(tenant_id text,demand_id text,material_id text,quantity numeric);
          insert into enterprises values ('s1','Supplier 1'),('s2','Supplier 2');
          insert into rfqs values ('r1','t','self','询价','已定标','s1',2),('r2','t','peer','询价','已定标','s2',1),
            ('r3','t','peer','询价','已关闭',null,1),('r4','t','peer','商城','已定标','s1',1),
            ('mixed','t','peer','询价','已定标','s1',1),('foreign','other','self','询价','已定标','s1',1);
          insert into purchase_demands values ('d1','t','self','A','已通过','2026-01-01T00:00:00Z'),
            ('d2','t','peer','A','已通过','2026-02-01T00:00:00Z'),('d3','t','peer','B','已通过','2026-03-01T00:00:00Z');
          insert into rfq_demands values ('t','r1','d1'),('t','r2','d2'),('t','r3','d3'),('t','mixed','d1'),('t','mixed','d3');
          insert into purchase_orders values
            ('o1','t','r1','s1',100.01,'待供应商确认','2025-12-31T16:00:00Z'),
            ('o2','t','r2','s2',200.02,'已收货','2026-02-28T16:00:00Z'),
            ('o3','t','r3','s1',300.03,'已取消','2026-03-31T15:59:59.999Z'),
            ('o4','t','r4','s1',400.04,'已收货','2026-03-31T16:00:00Z'),
            ('om','t','mixed','s1',500,'已收货','2026-02-01T00:00:00Z'),
            ('of','other','foreign','s1',900,'已收货','2026-02-01T00:00:00Z');
          insert into quotes values ('winner','t','r1','s1',2,'已中选',100.01),('comparable','t','r1','s2',2,'未中选',150.01),
            ('historical','t','r1','s2',1,'未中选',99999),('invalid','t','r1','s2',2,'已作废',88888),
            ('foreign-quote','other','r1','s2',2,'未中选',77777),('single','t','r2','s2',1,'已中选',200.02);
          insert into award_decisions values ('ad1','t','r1','winner','s1',100.01,'已通过','2026-01-01T00:00:00Z'),
            ('ad2','t','r1','winner','s1',100.01,'已通过','2026-01-02T00:00:00Z'),
            ('ad3','t','r2','single','s2',200.02,'已通过','2026-02-01T00:00:00Z');
          insert into materials values ('m1','t','Category A',10),('m2','t','Category B',20);
          insert into purchase_demand_items values ('t','d1','m1',2),('t','d2','m2',3),('t','d3','m1',4);
          """);
    }
    var configuration = new Configuration(new Environment("analytics", new SpringManagedTransactionFactory(), source));
    configuration.setMapUnderscoreToCamelCase(true);
    configuration.addMapper(BuyerAnalyticsMapper.class);
    mapper = new SqlSessionTemplate(new SqlSessionFactoryBuilder().build(configuration)).getMapper(BuyerAnalyticsMapper.class);
    scopes = mock(DataScopeService.class);
    permissions = mock(PermissionService.class);
    when(scopes.currentUserDataScope()).thenReturn(DataScope.unrestricted());
    TenantContext.set("t", null, "self");
  }

  private BuyerAnalyticsApplicationService service(BuyerAnalyticsMapper actual) {
    var factory = new ProxyFactory(new BuyerAnalyticsApplicationService(actual, permissions, scopes));
    factory.setProxyTargetClass(true);
    factory.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(source), new AnnotationTransactionAttributeSource()));
    return (BuyerAnalyticsApplicationService) factory.getProxy();
  }

  @AfterEach void close() { TenantContext.clear(); source.forceCloseAll(); }

  @Test void bothExportOverloadsCompleteWithOneConnectionWithoutAnOuterReportTransaction() throws Exception {
    try (var pool = new HikariDataSource()) {
      pool.setJdbcUrl(DB.getJdbcUrl());
      pool.setUsername(DB.getUsername());
      pool.setPassword(DB.getPassword());
      pool.setMaximumPoolSize(1);
      pool.setMinimumIdle(0);
      pool.setConnectionTimeout(500);
      pool.setPoolName("analytics-export-single-connection");
      var config = new Configuration(new Environment("single-connection", new SpringManagedTransactionFactory(), pool));
      config.setMapUnderscoreToCamelCase(true);
      config.addMapper(BuyerAnalyticsMapper.class);
      var singleMapper = new SqlSessionTemplate(new SqlSessionFactoryBuilder().build(config)).getMapper(BuyerAnalyticsMapper.class);
      var advice = new TransactionInterceptor(new DataSourceTransactionManager(pool), new AnnotationTransactionAttributeSource());
      var analyticsFactory = new ProxyFactory(new BuyerAnalyticsApplicationService(singleMapper, permissions, scopes));
      analyticsFactory.setProxyTargetClass(true);
      analyticsFactory.addAdvice(advice);
      var analytics = (BuyerAnalyticsApplicationService) analyticsFactory.getProxy();
      var access = mock(FinanceAccessService.class);
      when(access.requireScope(anyString())).thenAnswer(call -> {
        assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
        assertThat(new org.springframework.jdbc.core.JdbcTemplate(pool).queryForObject("select 1", Integer.class)).isEqualTo(1);
        return DataScope.unrestricted();
      });
      var reportFactory = new ProxyFactory(new FinanceReportApplicationService(access, null, null, new BuyerAnalyticsReportQuery(analytics)));
      reportFactory.setProxyTargetClass(true);
      reportFactory.addAdvice(advice);
      var reports = (FinanceReportApplicationService) reportFactory.getProxy();
      var filtered = reports.exportProcurementAnalytics("xlsx", from, to, null, null);
      try (var book = new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(filtered.content()))) {
        var sheet = book.getSheet("订单状态");
        assertThat(sheet.getRow(sheet.getLastRowNum()).getCell(2).getNumericCellValue()).isEqualTo(1100.06);
      }
      assertThat(reports.exportProcurementAnalytics("xlsx").content()).isNotEmpty();
      assertThat(pool.getHikariPoolMXBean().getActiveConnections()).isZero();
    }
  }

  @Test void calendarEdgesAndEveryOrderGroupReconcileIncludingPendingAndHistoricalCancelled() {
    var result = service(mapper).procurementAnalytics(from, to, null, null);
    assertThat(result.totalSpend()).isEqualByComparingTo("1100.06");
    assertThat(result.orderCount()).isEqualTo(4);
    assertThat(result.monthlySpend()).extracting(v -> v.period()).containsExactly("2026-01", "2026-02", "2026-03");
    assertThat(result.monthlySpend().stream().map(v -> v.totalAmount()).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add)).isEqualByComparingTo(result.totalSpend());
    assertThat(result.statusDistribution().stream().map(v -> v.totalAmount()).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add)).isEqualByComparingTo(result.totalSpend());
    assertThat(result.supplierSpend().stream().mapToInt(v -> v.orderCount()).sum()).isEqualTo(result.orderCount());
  }

  @Test void filtersNarrowOrdersButDemandEstimatesRemainAnExplicitSeparatePopulation() {
    var result = service(mapper).procurementAnalytics(from, to, "s1", "待供应商确认");
    assertThat(result.totalSpend()).isEqualByComparingTo("100.01");
    assertThat(result.biddingSavings()).isEqualByComparingTo("50.00");
    assertThat(result.categoryDemandEstimate().stream().map(v -> v.totalAmount()).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add)).isEqualByComparingTo("120");
    assertThat(service(mapper).procurementAnalytics(from, to, "s1", "已收货").biddingSavings()).isZero();
  }

  @Test void currentRoundComparableDifferenceDoesNotCountPriorRoundsInvalidQuotesOrDuplicateAwards() {
    assertThat(service(mapper).procurementAnalytics(from, to, null, null).biddingSavings()).isEqualByComparingTo("50.00");
  }

  @Test void selfDepartmentAndEmptyScopeDoNotLeakMixedOrdersOrForeignTenants() {
    when(scopes.currentUserDataScope()).thenReturn(DataScope.self("self"));
    assertThat(service(mapper).procurementAnalytics(from, to, null, null).totalSpend()).isEqualByComparingTo("100.01");
    when(scopes.currentUserDataScope()).thenReturn(DataScope.departments(List.of("A")));
    assertThat(service(mapper).procurementAnalytics(from, to, null, null).totalSpend()).isEqualByComparingTo("300.03");
    when(scopes.currentUserDataScope()).thenReturn(DataScope.departments(List.of("A", "B")));
    assertThat(service(mapper).procurementAnalytics(from, to, null, null).totalSpend()).isEqualByComparingTo("1100.06");
    when(scopes.currentUserDataScope()).thenReturn(DataScope.departments(List.of()));
    assertThat(service(mapper).procurementAnalytics(from, to, "s1", null).orderCount()).isZero();
  }

  @Test void concurrentCommitBetweenAggregatesCannotSplitTheSnapshot() throws Exception {
    var intercepted = mock(BuyerAnalyticsMapper.class, delegatesTo(mapper));
    doAnswer(call -> {
      var rows = mapper.monthlySpend(call.getArgument(0), call.getArgument(1), call.getArgument(2));
      try (var connection = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword()); var statement = connection.createStatement()) {
        statement.executeUpdate("update purchase_orders set amount=9999 where id='o1'");
      }
      return rows;
    }).when(intercepted).monthlySpend(anyString(), any(), any(ProcurementAnalyticsFilter.class));
    var result = service(intercepted).procurementAnalytics(from, to, null, null);
    assertThat(result.totalSpend()).isEqualByComparingTo("1100.06");
    assertThat(service(mapper).procurementAnalytics(from, to, null, null).totalSpend()).isEqualByComparingTo("10999.05");
  }
}
