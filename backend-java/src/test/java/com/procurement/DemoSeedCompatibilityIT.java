package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@DirtiesContext
class DemoSeedCompatibilityIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl);
    r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword);
    r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "classpath:db/demo");
  }

  @Autowired JdbcTemplate jdbc;
  @Autowired javax.sql.DataSource dataSource;

  @Test void freshDemoInitializesAfterMultiBatchConstraintsAreRemoved() throws Exception {
    assertThat(jdbc.queryForObject("select count(*) from deliveries where id in ('dlv-demo','dlv-invoiced')", Integer.class)).isEqualTo(2);
    assertThat(jdbc.queryForObject("select count(*) from receipts where id='rcpt-invoiced'", Integer.class)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from flyway_seed_history where not success", Integer.class)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from pg_constraint where conname in ('deliveries_tenant_id_order_id_key','receipts_tenant_id_order_id_key')", Integer.class)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from pg_indexes where indexname like 'seed_compat_%'", Integer.class)).isZero();
    assertThat(jdbc.queryForObject("select tgenabled::text from pg_trigger where tgname='protect_order_invoice_total'", String.class)).isEqualTo("O");
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update("insert into invoices(id,tenant_id,supplier_id,order_id,amount,invoice_no,payment_status) values ('seed-cap-check','tenant-acme','ent-supplier-sunrise','po-invoiced',1,'SEED-CAP','待付款')"))
        .isInstanceOf(org.springframework.dao.DataAccessException.class).hasMessageContaining("累计发票金额");
    jdbc.update("insert into deliveries(id,tenant_id,order_id,supplier_id,carrier,tracking_no,status) select 'second-demo-batch',tenant_id,order_id,supplier_id,carrier,'SECOND','已发货' from deliveries where id='dlv-demo'");
    new com.procurement.common.seed.SeedFlywayRunner().seedMigrations(dataSource, "classpath:db/demo")
        .run(new org.springframework.boot.DefaultApplicationArguments(new String[0]));
    assertThat(jdbc.queryForObject("select count(*) from deliveries where id in ('dlv-demo','second-demo-batch')", Integer.class)).isEqualTo(2);
  }
}
