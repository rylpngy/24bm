package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class DatabaseMigrationIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
      .withDatabaseName("procurement_saas_it")
      .withUsername("procurement")
      .withPassword("procurement");

  @DynamicPropertySource
  static void registerDatabaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
  }

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @Test
  void flywayCreatesCoreTablesAndTenantScopedDemandRecords() {
    List<String> tableNames = jdbcTemplate.queryForList("""
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name in (
            'tenants',
            'users',
            'materials',
            'purchase_demands',
            'purchase_demand_items',
            'dictionaries',
            'rfqs',
            'purchase_orders',
            'invoices',
            'invoice_reconciliations'
          )
        order by table_name
        """, String.class);

    assertThat(tableNames).containsExactly(
        "dictionaries",
        "invoices",
        "invoice_reconciliations",
        "materials",
        "purchase_demand_items",
        "purchase_demands",
        "purchase_orders",
        "rfqs",
        "tenants",
        "users"
    );

    jdbcTemplate.update("""
        insert into tenants (id, name, plan, status)
        values (?, ?, ?, ?)
        """, "tenant-it", "集成测试采购企业", "starter", "active");

    jdbcTemplate.update("""
        insert into users (id, tenant_id, name, status)
        values (?, ?, ?, ?)
        """, "user-requester-it", "tenant-it", "需求申请人", "active");

    jdbcTemplate.update("""
        insert into materials (id, tenant_id, code, name, category, unit, reference_price)
        values (?, ?, ?, ?, ?, ?, ?)
        """, "mat-laptop-it", "tenant-it", "IT-LAPTOP", "办公电脑", "办公设备", "台", BigDecimal.valueOf(6000));

    jdbcTemplate.update("""
        insert into purchase_demands (id, tenant_id, title, department_id, requester_id, budget, status)
        values (?, ?, ?, ?, ?, ?, ?)
        """,
        "demand-it",
        "tenant-it",
        "办公电脑采购",
        "dept-it",
        "user-requester-it",
        BigDecimal.valueOf(120000),
        "草稿");

    jdbcTemplate.update("""
        insert into purchase_demand_items (id, tenant_id, demand_id, material_id, quantity)
        values (?, ?, ?, ?, ?)
        """, "demand-item-it", "tenant-it", "demand-it", "mat-laptop-it", BigDecimal.valueOf(20));

    Integer itemCount = jdbcTemplate.queryForObject("""
        select count(*)
        from purchase_demand_items item
        join purchase_demands demand on demand.id = item.demand_id
        where demand.tenant_id = ?
          and demand.status = ?
        """, Integer.class, "tenant-it", "草稿");

    assertThat(itemCount).isEqualTo(1);
  }
}
