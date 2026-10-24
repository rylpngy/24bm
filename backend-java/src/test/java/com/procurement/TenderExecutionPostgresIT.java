package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.common.tenant.TenantContext;
import com.procurement.tender.api.AwardTenderRequest;
import com.procurement.tender.api.ExecuteTenderRequest;
import com.procurement.tender.application.TenderApplicationService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@org.springframework.test.annotation.DirtiesContext
class TenderExecutionPostgresIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl);
    r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword);
    r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired TenderApplicationService service;
  @MockBean com.procurement.common.storage.ObjectStorageService storage;
  @MockBean com.procurement.tenant.application.TenantFeatureApplicationService features;
  String tenant, user, supplier, tender, bid;

  @BeforeEach void seed() throws Exception {
    String suffix = UUID.randomUUID().toString();
    tenant = "tt-" + suffix; user = "tu-" + suffix; supplier = "ts-" + suffix;
    tender = "t-" + suffix; bid = "b-" + suffix;
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Tender','starter','active')", tenant);
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Buyer','active')", user, tenant);
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions) values (?,?,'buyer','Manager','[\"buyer:*\"]')", "role-" + suffix, tenant);
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)", user, "role-" + suffix);
    jdbc.update("insert into enterprises(id,name,type) values (?,'Winner','supplier')", supplier);
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level) values (?,?,?,'已准入','A')", "rel-" + suffix, tenant, supplier);
    jdbc.update("""
        insert into tenders(id,tenant_id,tender_no,title,tender_type,status,document_html,evaluation_method,
          acquisition_deadline,submission_deadline,opening_at,opened_at,owner_id)
        values (?,?,?,'Tender','公开招标','评标中','document','综合评分法',
          now()-interval '3 days',now()-interval '1 day',now()-interval '12 hours',now()-interval '12 hours',?)
        """, tender, tenant, tender, user);
    jdbc.update("insert into tender_acquisitions(id,tenant_id,tender_id,supplier_id,source,acquired_at) values (?,?,?,?,'公开领取',now()-interval '4 days')", "acq-" + suffix, tenant, tender, supplier);
    String payload = "tender-bid|tender:" + tender + "|supplier:" + supplier + "|amount:100|doc:bid";
    String digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8)));
    jdbc.update("""
        insert into tender_bids(id,tenant_id,tender_id,supplier_id,bid_amount,document_html,content_digest,sealed_status,submitted_at)
        values (?,?,?,?,100,'bid',?,'已开启',now()-interval '2 days')
        """, bid, tenant, tender, supplier, digest);
    for (int i = 0; i < 3; i++) {
      String evaluator = "e-" + i + suffix;
      jdbc.update("insert into tender_evaluators(id,tenant_id,tender_id,evaluator_name,evaluator_role) values (?,?,?,?,'成员')", evaluator, tenant, tender, "Member " + i);
      jdbc.update("""
          insert into tender_scores(id,tenant_id,tender_id,bid_id,evaluator_id,technical_score,commercial_score)
          values (?,?,?,?,?,80,80)
          """, "score-" + i + suffix, tenant, tender, bid, evaluator);
    }
    TenantContext.set(tenant, null, user);
  }

  @AfterEach void clear() { TenantContext.clear(); }

  @Test void concurrentTransfersCreateExactlyOneUnifiedOrderAndLine() throws Exception {
    service.awardTender(tender, new AwardTenderRequest(bid, "notice"));
    try (var pool = Executors.newFixedThreadPool(2)) {
      var start = new CountDownLatch(1);
      Callable<String> transfer = () -> {
        TenantContext.set(tenant, null, user);
        try {
          start.await();
          return service.executeTender(tender, new ExecuteTenderRequest(LocalDate.now().plusDays(3))).executionOrderId();
        } finally { TenantContext.clear(); }
      };
      var first = pool.submit(transfer);
      var second = pool.submit(transfer);
      start.countDown();
      String order = first.get(30, TimeUnit.SECONDS);
      assertThat(second.get(30, TimeUnit.SECONDS)).isEqualTo(order);
      assertThat(jdbc.queryForObject("select count(*) from purchase_orders where tenant_id=?", Integer.class, tenant)).isEqualTo(1);
      assertThat(jdbc.queryForObject("select count(*) from order_line_items where tenant_id=? and order_id=?", Integer.class, tenant, order)).isEqualTo(1);
      assertThat(jdbc.queryForObject("select count(*) from rfqs where tenant_id=?", Integer.class, tenant)).isEqualTo(1);
    }
  }

  @Test void failedUnifiedOrderCreationRollsBackAnchorAndExecutionMarker() {
    service.awardTender(tender, new AwardTenderRequest(bid, "notice"));
    jdbc.update("update buyer_supplier_relations set status='已退出' where tenant_id=?", tenant);
    assertThatThrownBy(() -> service.executeTender(tender, new ExecuteTenderRequest(LocalDate.now().plusDays(3))))
        .isInstanceOf(IllegalStateException.class);
    assertThat(jdbc.queryForObject("select count(*) from rfqs where tenant_id=?", Integer.class, tenant)).isZero();
    assertThat(jdbc.queryForObject("select execution_order_id from tenders where id=?", String.class, tender)).isNull();
  }

  @Test void incompleteEvaluationCannotPublishAwardOrNotice() {
    jdbc.update("delete from tender_scores where id=(select id from tender_scores where tenant_id=? limit 1)", tenant);
    assertThatThrownBy(() -> service.awardTender(tender, new AwardTenderRequest(bid, "notice")))
        .hasMessageContaining("完整评分");
    assertThat(jdbc.queryForObject("select awarded_bid_id from tenders where id=?", String.class, tender)).isNull();
    assertThat(jdbc.queryForObject("select count(*) from purchase_orders where tenant_id=?", Integer.class, tenant)).isZero();
  }

  @Test void readOnlyAndCrossTenantCommandsCannotMutateTender() {
    jdbc.update("update roles set permissions='[\"buyer:tender:read\"]' where tenant_id=?", tenant);
    assertThatThrownBy(() -> service.awardTender(tender, new AwardTenderRequest(bid, "notice")))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    jdbc.update("update roles set permissions='[\"buyer:*\"]' where tenant_id=?", tenant);
    TenantContext.set("other-tenant", null, user);
    assertThatThrownBy(() -> service.awardTender(tender, new AwardTenderRequest(bid, "notice")))
        .isInstanceOf(RuntimeException.class);
    assertThat(jdbc.queryForObject("select status from tenders where id=?", String.class, tender)).isEqualTo("评标中");
  }
}
