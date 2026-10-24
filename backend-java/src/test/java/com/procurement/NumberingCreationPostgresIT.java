package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.api.CreatePurchaseDemandRequest;
import com.procurement.demand.api.PurchaseDemandLineItemRequest;
import com.procurement.demand.application.DirectDemandRegistrar;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.numbering.application.NumberingApplicationService;
import com.procurement.numbering.domain.NumberingRule;
import com.procurement.tender.api.SaveTenderRequest;
import com.procurement.tender.application.TenderApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
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

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@org.springframework.test.annotation.DirtiesContext
class NumberingCreationPostgresIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl);
    r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword);
    r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired NumberingApplicationService numbering;
  @Autowired PurchaseDemandApplicationService demands;
  @Autowired DirectDemandRegistrar direct;
  @Autowired TenderApplicationService tenders;
  @Autowired org.springframework.boot.test.web.client.TestRestTemplate http;
  @Autowired com.procurement.identity.security.JwtTokenService tokens;
  @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
  @MockBean com.procurement.common.storage.ObjectStorageService storage;
  @MockBean com.procurement.tenant.application.TenantFeatureApplicationService features;
  record Buyer(String tenant, String user, String department, String material) {
    void enter() { TenantContext.set(tenant, null, user); }
  }
  Buyer first, second;

  @BeforeEach void seed() { first = buyer(); second = buyer(); first.enter(); }
  @AfterEach void clear() { TenantContext.clear(); }

  Buyer buyer() {
    String suffix = UUID.randomUUID().toString();
    Buyer b = new Buyer("number-tenant-" + suffix, "number-user-" + suffix, "dept-ITX" + suffix, "number-material-" + suffix);
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Numbering','starter','active')", b.tenant());
    jdbc.update("insert into users(id,tenant_id,name,status,department_id) values (?,?,'Admin','active',?)", b.user(), b.tenant(), b.department());
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions) values (?,?,'buyer','Admin','[\"buyer:*\"]')", "role-" + suffix, b.tenant());
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)", b.user(), "role-" + suffix);
    jdbc.update("insert into departments(id,tenant_id,name) values (?,?,'IT')", b.department(), b.tenant());
    jdbc.update("insert into materials(id,tenant_id,code,name,category,unit) values (?,?,'M','Material','IT','件')", b.material(), b.tenant());
    return b;
  }

  String normal(Buyer b) {
    b.enter();
    return demands.create(new CreatePurchaseDemandRequest("Demand", b.department(), BigDecimal.TEN,
        List.of(new PurchaseDemandLineItemRequest(b.material(), BigDecimal.ONE)),
        LocalDate.now().plusDays(10), "常规", "采购用途说明")).id();
  }
  String direct(Buyer b) {
    b.enter();
    return direct.registerApproved("Direct", b.department(), BigDecimal.TEN,
        List.of(new DirectDemandRegistrar.DirectLineItem(b.material(), 1)));
  }
  void configure(Buyer b, String type, String prefix, int width, boolean enabled) {
    b.enter(); numbering.save(type, new NumberingRule(type, prefix, "none", width, enabled));
  }

  @Test void mixedCreationPathsAndTenantsShareAtomicGlobalPrefixAllocator() throws Exception {
    String prefix = "N" + UUID.randomUUID().toString().replace("-", "").substring(0, 10) + "-";
    configure(first, "demand", prefix, 4, true);
    configure(second, "demand", prefix, 4, true);
    try (var pool = Executors.newFixedThreadPool(4)) {
      var gate = new CountDownLatch(1);
      List<Future<String>> jobs = new ArrayList<>();
      for (int i = 0; i < 20; i++) {
        int index = i;
        jobs.add(pool.submit(() -> {
          try { gate.await(); return index % 2 == 0 ? normal(index % 4 == 0 ? first : second) : direct(index % 4 == 1 ? first : second); }
          finally { TenantContext.clear(); }
        }));
      }
      gate.countDown();
      List<String> numbers = new ArrayList<>();
      for (var job : jobs) numbers.add(job.get(45, TimeUnit.SECONDS));
      assertThat(numbers).hasSize(20).doesNotHaveDuplicates().allMatch(n -> n.startsWith(prefix));
      assertThat(jdbc.queryForObject("select last_value from demand_number_sequences where prefix=?", Long.class, prefix)).isEqualTo(20);
    }
  }

  @Test void defaultsLegacyGapsAndExistingLinksArePreservedAcrossBothPaths() {
    String prefix = "ITX" + LocalDate.now(java.time.ZoneId.of("Asia/Shanghai")).format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
    // A sparse legacy ID must bootstrap by global maximum, not tenant-local record count.
    String legacy = prefix + "900";
    jdbc.update("insert into purchase_demands(id,tenant_id,title,department_id,requester_id,budget,status) values (?,?, 'Legacy',?,?,1,'草稿')", legacy, first.tenant(), first.department(), first.user());
    jdbc.update("insert into purchase_demand_items(id,tenant_id,demand_id,material_id,quantity) values (?,?,?,?,1)", "legacy-item-" + first.tenant(), first.tenant(), legacy, first.material());
    assertThat(normal(second)).isEqualTo(prefix + "901");
    assertThat(direct(first)).isEqualTo(prefix + "902");
    assertThat(jdbc.queryForObject("select demand_id from purchase_demand_items where id=?", String.class, "legacy-item-" + first.tenant())).isEqualTo(legacy);
  }

  @Test void editedDisabledAndRestoredRulesNeverResetSequencesOrReuseDeletedCodes() {
    String prefix = "R" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    configure(first, "demand", prefix, 3, true);
    String old = normal(first);
    jdbc.update("delete from purchase_demand_items where demand_id=?", old);
    jdbc.update("delete from purchase_demands where id=?", old);
    // Overlapping prefixes and different widths would both generate the exact same ID.
    configure(second, "demand", prefix + "0", 2, true);
    assertThat(direct(second)).isEqualTo(prefix + "002");
    configure(first, "demand", prefix, 3, false);
    assertThat(normal(first)).startsWith("ITX").isNotEqualTo(old);
    configure(first, "demand", prefix, 3, true);
    assertThat(normal(first)).isEqualTo(prefix + "003");
  }

  @Test void tenderUsesCustomDisplayNumberButRetainsUuidInternalIdentity() {
    String prefix = "T" + UUID.randomUUID().toString().replace("-", "").substring(0, 10) + "-";
    configure(first, "tender", prefix, 4, true);
    var result = tenders.create(new SaveTenderRequest("Tender", "公开招标", BigDecimal.TEN, "body", "综合评分法", BigDecimal.ZERO, null, null, null));
    assertThat(result.tenderNo()).isEqualTo(prefix + "0001");
    assertThat(result.id()).startsWith("tender-").isNotEqualTo(result.tenderNo());
    configure(second, "tender", prefix, 4, true);
    var other = tenders.create(new SaveTenderRequest("Other", "公开招标", BigDecimal.TEN, "body", "综合评分法", BigDecimal.ZERO, null, null, null));
    assertThat(other.tenderNo()).isEqualTo(prefix + "0002");
    assertThat(jdbc.queryForObject("select tender_no from tenders where id=?", String.class, result.id())).isEqualTo(prefix + "0001");
  }

  @Test void previewDoesNotAllocateAndConfigurationIsTenantScopedAuditedAndAdminOnly() {
    String prefix = "P" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    configure(first, "demand", prefix, 3, true);
    var rule = new NumberingRule("demand", prefix, "none", 3, true);
    for (int i = 0; i < 3; i++) assertThat(numbering.preview("demand", rule).consumesSequence()).isFalse();
    assertThat(jdbc.queryForObject("select count(*) from demand_number_sequences where prefix=?", Integer.class, prefix)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from numbering_reservations where number like ?", Integer.class, prefix + "%")).isZero();
    second.enter();
    assertThat(numbering.list()).filteredOn(r -> r.businessType().equals("demand")).singleElement().satisfies(r -> assertThat(r.enabled()).isFalse());
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where tenant_id=? and action='numbering_rule.updated'", Integer.class, first.tenant())).isEqualTo(1);
    jdbc.update("update roles set permissions='[\"buyer:demand:create\"]' where tenant_id=?", second.tenant());
    assertThatThrownBy(numbering::list).isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    assertThatThrownBy(() -> numbering.save("demand", rule)).isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    assertThatThrownBy(() -> numbering.preview("demand", rule)).isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
  }

  @Test void authenticatedHttpConfigurationPreviewAndBothBusinessCreationsAreReal() throws Exception {
    String prefix = "H" + UUID.randomUUID().toString().replace("-", "").substring(0, 10) + "-";
    var headers = new org.springframework.http.HttpHeaders();
    headers.setBearerAuth(tokens.issue(new com.procurement.identity.domain.AuthenticatedPrincipal(
        first.user(), "Admin", com.procurement.identity.domain.IdentityScope.BUYER, first.tenant(), null, List.of("BUYER_OWNER"))));
    headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
    String base = "/api/v1/buyer/numbering-rules";
    String draft = json.writeValueAsString(new NumberingRule("demand", prefix, "none", 4, true));
    var preview = http.exchange(base + "/demand/preview", org.springframework.http.HttpMethod.POST,
        new org.springframework.http.HttpEntity<>(draft, headers), String.class);
    assertThat(preview.getStatusCode().value()).isEqualTo(200);
    assertThat(json.readTree(preview.getBody()).at("/data/example").asText()).isEqualTo(prefix + "0001");
    assertThat(json.readTree(preview.getBody()).at("/data/consumesSequence").asBoolean()).isFalse();
    for (String type : List.of("demand", "tender")) {
      var saved = http.exchange(base + "/" + type, org.springframework.http.HttpMethod.PUT,
          new org.springframework.http.HttpEntity<>(draft, headers), String.class);
      assertThat(saved.getStatusCode().value()).isEqualTo(200);
    }
    var listed = http.exchange(base, org.springframework.http.HttpMethod.GET,
        new org.springframework.http.HttpEntity<>(headers), String.class);
    assertThat(listed.getStatusCode().value()).isEqualTo(200);
    assertThat(json.readTree(listed.getBody()).at("/data").size()).isEqualTo(2);
    var demandRequest = new CreatePurchaseDemandRequest("HTTP demand", first.department(), BigDecimal.TEN,
        List.of(new PurchaseDemandLineItemRequest(first.material(), BigDecimal.ONE)),
        LocalDate.now().plusDays(10), "常规", "采购用途说明");
    var demandResponse = http.exchange("/api/v1/buyer/demands", org.springframework.http.HttpMethod.POST,
        new org.springframework.http.HttpEntity<>(json.writeValueAsString(demandRequest), headers), String.class);
    assertThat(demandResponse.getStatusCode().value()).isEqualTo(201);
    assertThat(json.readTree(demandResponse.getBody()).at("/data/id").asText()).isEqualTo(prefix + "0001");
    first.enter();
    assertThat(direct(first)).isEqualTo(prefix + "0002");
    var tenderRequest = new SaveTenderRequest("HTTP-configured tender", "公开招标", BigDecimal.TEN, "body", "综合评分法", BigDecimal.ZERO, null, null, null);
    var tenderResponse = http.exchange("/api/v1/buyer/tenders", org.springframework.http.HttpMethod.POST,
        new org.springframework.http.HttpEntity<>(json.writeValueAsString(tenderRequest), headers), String.class);
    assertThat(tenderResponse.getStatusCode().value()).isEqualTo(200);
    assertThat(json.readTree(tenderResponse.getBody()).at("/data/tenderNo").asText()).isEqualTo(prefix + "0001");
    assertThat(json.readTree(tenderResponse.getBody()).at("/data/id").asText()).startsWith("tender-");
    var invalid = http.exchange(base + "/contract", org.springframework.http.HttpMethod.PUT,
        new org.springframework.http.HttpEntity<>(draft, headers), String.class);
    assertThat(invalid.getStatusCode().is4xxClientError()).isTrue();
    jdbc.update("update roles set permissions='[\"buyer:demand:create\"]' where tenant_id=?", first.tenant());
    var denied = http.exchange(base, org.springframework.http.HttpMethod.GET,
        new org.springframework.http.HttpEntity<>(headers), String.class);
    assertThat(denied.getStatusCode().value()).isEqualTo(403);
    for (var entry : java.util.Map.of(base + "/demand", org.springframework.http.HttpMethod.PUT,
        base + "/demand/preview", org.springframework.http.HttpMethod.POST).entrySet()) {
      var forbidden = http.exchange(entry.getKey(), entry.getValue(),
          new org.springframework.http.HttpEntity<>(draft, headers), String.class);
      assertThat(forbidden.getStatusCode().value()).isEqualTo(403);
    }
  }
}
