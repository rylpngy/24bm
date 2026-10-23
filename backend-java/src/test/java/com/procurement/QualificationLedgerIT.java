package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import com.procurement.supplier.infrastructure.QualificationLedgerMapper;
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
class QualificationLedgerIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl); r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword); r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired QualificationLedgerMapper mapper;
  @Test void isolatesTenantsAndFiltersCurrentCertificatesBeforePagination() {
    jdbc.update("insert into tenants(id,name,plan,status) values ('a','甲','starter','active'),('b','乙','starter','active')");
    jdbc.update("insert into enterprises(id,name,type) values ('s','共享供应商','supplier'),('private','私有供应商','supplier')");
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level) values ('ra','a','s','已准入','B'),('rb','b','s','待准入','B'),('rp','b','private','已准入','B')");
    LocalDate today = LocalDate.now();
    certificate("expired", "s", today.minusDays(1), "active");
    certificate("today", "s", today, "active");
    certificate("boundary", "s", today.plusDays(30), "active");
    certificate("future", "s", today.plusDays(31), "active");
    certificate("missing", "s", null, "active");
    certificate("inactive", "s", today, "inactive");
    certificate("replaced", "s", today, "active");
    jdbc.update("update supplier_qualifications set replaced_by='today' where id='replaced'");
    certificate("secret", "private", today, "active");
    assertThat(mapper.count("a", null, "all", today, today.plusDays(30))).isEqualTo(5);
    assertThat(mapper.count("a", null, "expiring", today, today.plusDays(30))).isEqualTo(2);
    assertThat(mapper.count("a", null, "expired", today, today.plusDays(30))).isEqualTo(1);
    assertThat(mapper.count("a", null, "unknown", today, today.plusDays(30))).isEqualTo(1);
    assertThat(mapper.count("a", "secret", "all", today, today.plusDays(30))).isZero();
    assertThat(mapper.count("b", "secret", "all", today, today.plusDays(30))).isEqualTo(1);
    assertThat(mapper.count("a", "%", "all", today, today.plusDays(30))).isZero();
    var rows = mapper.list("a", "共享", "expiring", today, today.plusDays(30), 1, 1);
    assertThat(rows).hasSize(1);
    assertThat(rows.getFirst().qualificationId()).isEqualTo("boundary");
    assertThat(rows.getFirst().relationId()).isEqualTo("ra");
    assertThat(rows.getFirst().expiryState()).isEqualTo("expiring");
  }
  void certificate(String id, String supplier, LocalDate expiry, String status) {
    jdbc.update("insert into supplier_qualifications(id,supplier_id,qualification_type,certificate_no,expires_at,status,file_name,storage_key) values (?,?, '营业执照',?,?,?,'test.pdf','test')", id, supplier, id, expiry, status);
  }
}
