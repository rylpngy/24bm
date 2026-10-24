package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.buyer.infrastructure.DepartmentBudgetMapper;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class DepartmentBudgetPaymentLedgerIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  private Connection connection;

  @BeforeEach void setup() throws Exception {
    connection = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    sql("create temp table departments(id text,tenant_id text,name text)");
    sql("create temp table department_budgets(id text,tenant_id text,department_id text,period text,total_amount numeric)");
    sql("create temp table purchase_demands(id text,tenant_id text,department_id text,budget numeric,status text,created_at timestamptz)");
    sql("create temp table rfq_demands(tenant_id text,rfq_id text,demand_id text)");
    sql("create temp table purchase_orders(id text,tenant_id text,rfq_id text)");
    sql("create temp table invoices(id text,tenant_id text,order_id text,payment_status text default '未付款')");
    sql("create temp table invoice_payment_entries(id text,tenant_id text,invoice_id text,amount numeric,reversal_of text)");
    // Legacy tables exist deliberately: a paid milestone must never be counted alongside its ledger entry.
    sql("create temp table contracts(id text,tenant_id text,related_order_id text)");
    sql("create temp table contract_payment_milestones(contract_id text,tenant_id text,status text,amount numeric)");
    sql("insert into departments values ('a','t','A'),('b','t','B')");
    sql("insert into department_budgets values ('ba','t','a','2026',1200),('bb','t','b','2026',600)");
    sql("insert into purchase_demands values ('da','t','a',1200,'已通过','2026-01-01'),('db','t','b',600,'已通过','2026-01-01')");
    sql("insert into rfq_demands values ('t','rfq','da'),('t','rfq','db')");
    sql("insert into purchase_orders values ('po','t','rfq')");
    sql("insert into invoices(id,tenant_id,order_id) values ('inv','t','po')");
  }

  @AfterEach void close() throws Exception { if (connection != null) connection.close(); }

  @Test void noMilestonePaymentsAreAllocated1200And600AndNotCountedAgainAsMilestones() throws Exception {
    sql("insert into invoice_payment_entries values ('p1','t','inv',600,null),('p2','t','inv',1200,null)");
    assertThat(amounts()).containsEntry("a", new BigDecimal("1200.00")).containsEntry("b", new BigDecimal("600.00"));
    sql("insert into contracts values ('c','t','po')");
    sql("insert into contract_payment_milestones values ('c','t','已付',1800)");
    assertThat(amounts()).containsEntry("a", new BigDecimal("1200.00")).containsEntry("b", new BigDecimal("600.00"));
  }

  @Test void reversalsReduceActualPaymentsAndFixedLastDepartmentAbsorbsRoundingRemainder() throws Exception {
    sql("insert into invoice_payment_entries values ('p','t','inv',100,null),('r','t','inv',-100,'p'),('p2','t','inv',0.01,null)");
    var amounts = amounts();
    assertThat(amounts.get("a")).isEqualByComparingTo("0.01");
    assertThat(amounts.get("b")).isEqualByComparingTo("0.00");
    assertThat(amounts.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo("0.01");
  }

  @Test void zeroBudgetIsExplicitlyUnallocatedAndShowsRelatedNetPaymentInsteadOfFalseZero() throws Exception {
    sql("update purchase_demands set budget=0 where id='db'");
    sql("insert into invoice_payment_entries values ('p','t','inv',1800,null)");
    try (var rows = connection.createStatement().executeQuery(DepartmentBudgetMapper.BUDGET_SELECT + " where b.tenant_id='t'")) {
      int count = 0;
      while (rows.next()) {
        assertThat(rows.getBigDecimal("disbursed")).isNull();
        assertThat(rows.getBigDecimal("pending_allocation_amount")).isEqualByComparingTo("1800");
        count++;
      }
      assertThat(count).isEqualTo(2);
    }
  }

  @Test void ledgerAndDemandJoinsAreTenantScoped() throws Exception {
    sql("insert into invoice_payment_entries values ('foreign','other','inv',9000,null)");
    sql("insert into invoice_payment_entries values ('own','t','inv',1800,null)");
    assertThat(amounts()).containsEntry("a", new BigDecimal("1200.00")).containsEntry("b", new BigDecimal("600.00"));
  }

  @Test void actualMyBatisMapperPreservesUnallocatedNullAndRelatedAmount() throws Exception {
    sql("update purchase_demands set budget=0 where id='db'");
    sql("insert into invoice_payment_entries values ('p','t','inv',1800,null)");
    var dataSource = new org.apache.ibatis.datasource.unpooled.UnpooledDataSource(
        "org.postgresql.Driver", DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    var configuration = new org.apache.ibatis.session.Configuration(new org.apache.ibatis.mapping.Environment(
        "budget-test", new org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory(), dataSource));
    configuration.setMapUnderscoreToCamelCase(true);
    configuration.addMapper(DepartmentBudgetMapper.class);
    var factory = new org.apache.ibatis.session.SqlSessionFactoryBuilder().build(configuration);
    try (var session = factory.openSession(connection)) {
      var rows = session.getMapper(DepartmentBudgetMapper.class)
          .listByTenant("t", com.procurement.identity.domain.DataScope.unrestricted());
      assertThat(rows).hasSize(2).allSatisfy(row -> {
        assertThat(row.disbursed()).isNull();
        assertThat(row.pendingAllocationAmount()).isEqualByComparingTo("1800");
      });
    }
  }

  @Test void historicalPaidInvoiceWithoutLedgerIsUnknownNotZeroForEveryLinkedDepartment() throws Exception {
    sql("update invoices set payment_status='部分付款' where id='inv'");
    try (var rows = connection.createStatement().executeQuery(DepartmentBudgetMapper.BUDGET_SELECT + " where b.tenant_id='t'")) {
      int count = 0;
      while (rows.next()) {
        assertThat(rows.getBigDecimal("disbursed")).isNull();
        assertThat(rows.getInt("unverified_payment_count")).isEqualTo(1);
        count++;
      }
      assertThat(count).isEqualTo(2);
    }
  }

  private Map<String, BigDecimal> amounts() throws Exception {
    Map<String, BigDecimal> result = new HashMap<>();
    try (var rows = connection.createStatement().executeQuery(DepartmentBudgetMapper.BUDGET_SELECT + " where b.tenant_id='t'")) {
      while (rows.next()) result.put(rows.getString("department_id"), rows.getBigDecimal("disbursed"));
    }
    return result;
  }

  private void sql(String sql) throws Exception { try (var statement = connection.createStatement()) { statement.execute(sql); } }
}
