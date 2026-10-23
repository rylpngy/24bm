package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.supplier.application.QualificationNotificationService;
import java.time.LocalDate;
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
@Testcontainers
@org.springframework.test.annotation.DirtiesContext
class QualificationNotificationIT {
  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("keycloak.enabled", () -> false);
    registry.add("app.seed.locations", () -> "");
  }

  @Autowired JdbcTemplate jdbc;
  @Autowired QualificationNotificationService service;

  @Test
  void targetsAuthorizedUsersAndDeduplicatesReviewAndExpiryEvents() {
    jdbc.update("insert into tenants(id,name,plan,status) values ('a','企业甲','starter','active'),('b','企业乙','starter','active')");
    jdbc.update("insert into enterprises(id,name,type) values ('s','供应商','supplier')");
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level) values ('r','a','s','已准入','B')");
    buyer("reviewer", "a", "active", "[\"buyer:*\"]");
    buyer("reader", "a", "active", "[\"buyer:supplier:read\"]");
    buyer("disabled", "a", "inactive", "[\"buyer:*\"]");
    buyer("other", "b", "active", "[\"buyer:*\"]");
    jdbc.update("insert into users(id,supplier_id,name,status) values ('supplier','s','资质维护人','active')");
    jdbc.update("insert into roles(id,scope,name,permissions) values ('supplier-role','supplier','资质','[\"supplier:qualification:read\"]'::jsonb)");
    jdbc.update("insert into user_roles(user_id,role_id) values ('supplier','supplier-role')");
    LocalDate today = LocalDate.of(2026, 10, 23);
    qualification("q", today.plusDays(30), "active");
    qualification("no-date", null, "active");
    qualification("inactive", today, "inactive");
    qualification("future", today.plusDays(31), "active");
    qualification("old", today, "active");
    jdbc.update("update supplier_qualifications set replaced_by='q' where id='old'");
    long review = jdbc.queryForObject("insert into supplier_qualification_reviews(relation_id,qualification_id,previous_id) values ('r','q','old') returning id", Long.class);

    service.reviewCreated("s", "q");
    service.reviewCreated("s", "q");
    assertThat(count()).isEqualTo(1);
    assertThat(jdbc.queryForList("select recipient_id from notifications", String.class)).containsExactly("reviewer");

    jdbc.update("update supplier_qualification_reviews set status='rejected',comment='请补件' where id=?", review);
    service.reviewCompleted("b", review);
    assertThat(count()).isEqualTo(1);
    service.reviewCompleted("a", review);
    service.reviewCompleted("a", review);
    assertThat(count()).isEqualTo(2);
    assertThat(jdbc.queryForObject("select content from notifications where recipient_id='supplier'", String.class)).contains("请补件");

    service.remindExpiry(today);
    service.remindExpiry(today);
    assertThat(count()).isEqualTo(4);
    assertThat(jdbc.queryForList("select distinct recipient_id from notifications", String.class))
        .containsExactlyInAnyOrder("reviewer", "supplier");
    // Remove the out-of-window fixture from later phases without deleting history.
    jdbc.update("update supplier_qualifications set status='inactive' where id='future'");
    service.remindExpiry(today.plusDays(30));
    service.remindExpiry(today.plusDays(31));
    service.remindExpiry(today.plusDays(32));
    assertThat(count()).isEqualTo(8);
    assertThat(jdbc.queryForObject("select count(*) from notifications where content like '%已过期%'", Integer.class)).isEqualTo(2);
  }

  private int count() { return jdbc.queryForObject("select count(*) from notifications", Integer.class); }

  private void buyer(String id, String tenant, String status, String permissions) {
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,?,?)", id, tenant, id, status);
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions) values (?,?,'buyer',?,?::jsonb)", id, tenant, id, permissions);
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)", id, id);
  }

  private void qualification(String id, LocalDate expiry, String status) {
    jdbc.update("insert into supplier_qualifications(id,supplier_id,qualification_type,certificate_no,expires_at,file_name,storage_key,status) values (?,'s','营业执照',?,?,'a.pdf',?,?)", id, id, expiry, id, status);
  }
}
