package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class NumberingMigrationPostgresIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");

  @Test void migrationReservesAllLegacyCodesWithoutRewritingIdsLinksOrAllocatorState() {
    var source = new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    Flyway.configure().dataSource(source).target("228").load().migrate();
    var jdbc = new JdbcTemplate(source);
    jdbc.update("insert into tenants(id,name,plan,status) values ('legacy-tenant','Legacy','starter','active')");
    jdbc.update("insert into users(id,tenant_id,name,status) values ('legacy-user','legacy-tenant','Legacy','active')");
    jdbc.update("insert into materials(id,tenant_id,code,name,category,unit) values ('legacy-material','legacy-tenant','L','Legacy','IT','件')");
    jdbc.update("insert into purchase_demands(id,tenant_id,title,department_id,requester_id,budget,status) values ('A001','legacy-tenant','Legacy','dept-it','legacy-user',1,'草稿')");
    jdbc.update("insert into purchase_demand_items(id,tenant_id,demand_id,material_id,quantity) values ('legacy-item','legacy-tenant','A001','legacy-material',1)");
    jdbc.update("insert into tenders(id,tenant_id,tender_no,title,tender_type,status,owner_id) values ('legacy-tender-uuid','legacy-tenant','A001','Legacy','公开招标','编制中','legacy-user')");
    jdbc.update("insert into demand_number_sequences(prefix,last_value) values ('A',12)");
    Flyway.configure().dataSource(source).target("229").load().migrate();
    assertThat(jdbc.queryForObject("select id from purchase_demands where id='A001'", String.class)).isEqualTo("A001");
    assertThat(jdbc.queryForObject("select demand_id from purchase_demand_items where id='legacy-item'", String.class)).isEqualTo("A001");
    assertThat(jdbc.queryForObject("select tender_no from tenders where id='legacy-tender-uuid'", String.class)).isEqualTo("A001");
    assertThat(jdbc.queryForObject("select last_value from demand_number_sequences where prefix='A'", Long.class)).isEqualTo(12);
    assertThat(jdbc.queryForObject("select count(*) from numbering_reservations where number='A001'", Integer.class)).isEqualTo(2);
    assertThat(jdbc.queryForObject("select count(*) from numbering_rules", Integer.class)).isZero();
  }
}
