package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@org.springframework.test.annotation.DirtiesContext(classMode = org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class QualityHardeningIT {
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
  @Autowired MockMvc http;
  @Autowired ObjectMapper json;
  @Autowired PasswordEncoder passwords;
  @Autowired PurchaseDemandMapper demands;
  @Autowired com.procurement.finance.infrastructure.ThreeWayMatchMapper matches;
  @org.springframework.boot.test.mock.mockito.MockBean
  com.procurement.common.storage.ObjectStorageService storage;

  private String tenant;
  private String user;
  private String department;
  private String role;

  @BeforeEach
  void seedIsolatedAccount() {
    String suffix = UUID.randomUUID().toString();
    tenant = "tenant-" + suffix;
    user = "user-" + suffix;
    department = "dept-" + suffix;
    role = "role-" + suffix;
    jdbc.update("insert into tenants (id,name,plan,status) values (?, 'Hardening test', 'starter','active')", tenant);
    jdbc.update("insert into departments (id,tenant_id,name,status) values (?,?,'Test','active')", department, tenant);
    jdbc.update("""
        insert into users (id,tenant_id,name,status,department_id,password_hash)
        values (?,?,'Test user','active',?,?)
        """, user, tenant, department, passwords.encode("Quality-Test-123!"));
    jdbc.update("""
        insert into roles (id,tenant_id,scope,name,permissions,data_scope)
        values (?,?,'buyer','Test role','["buyer:demand:read","buyer:demand:create"]'::jsonb,'self')
        """, role, tenant);
    jdbc.update("insert into user_roles (user_id,role_id) values (?,?)", user, role);
  }

  @Test
  void disabledAndReenabledAccountsCannotReuseOldTokens() throws Exception {
    String token = login();
    listWith(token, 200);
    jdbc.update("update users set status = 'inactive' where id = ?", user);
    listWith(token, 401);
    jdbc.update("update users set status = 'active' where id = ?", user);
    listWith(token, 401);
    listWith(login(), 200);
  }

  @Test
  void passwordResetAndRoleChangesTakeEffectForExistingTokens() throws Exception {
    String token = login();
    jdbc.update("update roles set permissions = '[]'::jsonb where id = ?", role);
    listWith(token, 403);
    jdbc.update("update roles set permissions = '[\"buyer:demand:read\"]'::jsonb where id = ?", role);
    listWith(token, 200);
    jdbc.update("update users set password_hash = ? where id = ?", passwords.encode("New-Password-123!"), user);
    listWith(token, 401);
  }

  @Test
  void demandMutationsRequirePermissionAndCurrentRowScope() throws Exception {
    String token = login();
    String demand = "other-demand-" + UUID.randomUUID();
    String otherUser = "other-" + user;
    jdbc.update("insert into users (id,tenant_id,name,status,department_id) values (?,?,'Other','active',?)",
        otherUser, tenant, department);
    insertDemand(demand, otherUser);
    http.perform(get("/api/v1/buyer/demands/{id}", demand).header("Authorization", "Bearer " + token))
        .andExpect(status().isForbidden());
    http.perform(get("/api/v1/buyer/attachments").param("ownerType", "purchase_demand").param("ownerId", demand)
            .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    String body = json.writeValueAsString(Map.of("title", "Forbidden edit", "departmentId", department,
        "budget", 100, "lineItems", List.of(Map.of("materialId", "not-used", "quantity", 1))));
    http.perform(put("/api/v1/buyer/demands/{id}", demand).header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isForbidden());
    http.perform(post("/api/v1/buyer/demands/{id}/submit", demand).header("Authorization", "Bearer " + token))
        .andExpect(status().isForbidden());
    jdbc.update("update roles set permissions = '[\"buyer:demand:read\"]'::jsonb where id = ?", role);
    http.perform(post("/api/v1/buyer/demands").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isForbidden());
    assertThat(jdbc.queryForObject("select title from purchase_demands where id = ?", String.class, demand))
        .isEqualTo("Original");
  }

  @Test
  void demandPagesCountOnlyVisibleRowsAndSupportDetailsOutsideFirstPage() throws Exception {
    String otherUser = "other-" + user;
    jdbc.update("insert into users (id,tenant_id,name,status) values (?,?,'Other','active')", otherUser, tenant);
    insertDemand("hidden-" + user, otherUser);
    for (int i = 0; i < 10; i++) insertDemand("page-" + i + "-" + user, user);
    String token = login();
    var first = http.perform(get("/api/v1/buyer/demands/page").param("page", "1").param("pageSize", "8")
        .header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
    var page = json.readTree(first.getResponse().getContentAsString()).path("data");
    assertThat(page.path("total").asInt()).isEqualTo(10);
    assertThat(page.path("items").size()).isEqualTo(8);
    var second = http.perform(get("/api/v1/buyer/demands/page").param("page", "2").param("pageSize", "8")
        .header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
    var rows = json.readTree(second.getResponse().getContentAsString()).path("data").path("items");
    assertThat(rows.size()).isEqualTo(2);
    for (var row : rows) {
      assertThat(page.path("items").toString()).doesNotContain(row.path("id").asText());
      http.perform(get("/api/v1/buyer/demands/{id}", row.path("id").asText())
          .header("Authorization", "Bearer " + token)).andExpect(status().isOk());
    }
    var filtered = http.perform(get("/api/v1/buyer/demands/page").param("keyword", "page-1-")
        .header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
    assertThat(json.readTree(filtered.getResponse().getContentAsString()).path("data").path("total").asInt()).isEqualTo(1);
    http.perform(get("/api/v1/buyer/demands/page").param("pageSize", "101")
        .header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
    http.perform(get("/api/v1/buyer/demands/page").param("page", "0")
        .header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
  }

  @Test
  void uploadsRequireBoundUnexpiredSingleUseTicketsAndCannotRebindOrOverwrite() throws Exception {
    String id = "upload-" + user;
    insertDemand(id, user);
    insertDemand("alternate-" + id, user);
    String token = login();
    var ticket = issueTicket(token, id);
    String key = ticket.path("storageKey").asText();
    String url = ticket.path("uploadUrl").asText();
    var body = new java.util.HashMap<String, Object>(Map.of("ownerType", "purchase_demand", "ownerId", id,
        "fileName", "test.txt", "storageKey", key, "visibility", "buyer_internal"));
    http.perform(post("/api/v1/buyer/attachments").header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isForbidden());
    http.perform(post(java.net.URI.create(url)).header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_OCTET_STREAM).content("first")).andExpect(status().isOk());
    http.perform(post(java.net.URI.create(url)).header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_OCTET_STREAM).content("overwrite")).andExpect(status().isForbidden());
    body.put("ownerId", "alternate-" + id);
    http.perform(post("/api/v1/buyer/attachments").header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isForbidden());
    body.put("ownerId", id);
    http.perform(post("/api/v1/buyer/attachments").header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isCreated());
    http.perform(post("/api/v1/buyer/attachments").header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isForbidden());
    assertThat(jdbc.queryForObject("select count(*) from attachments where tenant_id = ? and storage_key = ?", Integer.class, tenant, key))
        .isEqualTo(1);
    org.mockito.Mockito.verify(storage).put(org.mockito.ArgumentMatchers.eq(key), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.isNull());
    var expired = issueTicket(token, id);
    jdbc.update("update attachment_upload_tickets set expires_at = now() - interval '1 minute' where storage_key = ?", expired.path("storageKey").asText());
    http.perform(post(java.net.URI.create(expired.path("uploadUrl").asText())).header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_OCTET_STREAM).content("expired")).andExpect(status().isForbidden());
    http.perform(post("/api/v1/buyer/attachments/upload-sink").param("storageKey", key)
        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_OCTET_STREAM).content("missing-token"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void attachmentReadAndWriteRecheckBusinessScopeAndUnknownTypesFailClosed() throws Exception {
    String id = "access-" + user;
    insertDemand(id, user);
    String token = login();
    var ticket = issueTicket(token, id);
    jdbc.update("update roles set permissions = '[\"buyer:demand:read\"]'::jsonb where id = ?", role);
    http.perform(post(java.net.URI.create(ticket.path("uploadUrl").asText())).header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_OCTET_STREAM).content("no-write")).andExpect(status().isForbidden());
    http.perform(get("/api/v1/buyer/attachments").param("ownerType", "unknown").param("ownerId", id)
        .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    String attachment = "attachment-" + user;
    jdbc.update("""
        insert into attachments (id,tenant_id,owner_type,owner_id,file_name,storage_key,uploaded_by,visibility,status)
        values (?,?,'purchase_demand',?,'test.txt',?,?,'private','active')
        """, attachment, tenant, id, tenant + "/purchase_demand/" + id + "/test.txt", user);
    jdbc.update("update roles set data_scope = 'department' where id = ?", role);
    jdbc.update("update users set department_id = null where id = ?", user);
    http.perform(get("/api/v1/buyer/attachments/{id}/download", attachment).header("Authorization", "Bearer " + token))
        .andExpect(status().isForbidden());
    org.mockito.Mockito.verifyNoInteractions(storage);
  }

  @Test
  void uploadedFingerprintIsPersistedAndCannotBeForgedByRegistration() throws Exception {
    String demand = "integrity-" + user;
    insertDemand(demand, user);
    String token = login();
    var ticket = issueTicket(token, demand);
    String key = ticket.path("storageKey").asText();
    http.perform(post(java.net.URI.create(ticket.path("uploadUrl").asText())).header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_OCTET_STREAM).content("original"))
        .andExpect(status().isOk());
    var result = http.perform(post("/api/v1/buyer/attachments").header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
            "ownerType", "purchase_demand", "ownerId", demand, "fileName", "test.txt", "storageKey", key,
            "visibility", "buyer_internal", "contentSha256", "forged", "contentSize", 999))))
        .andExpect(status().isCreated()).andReturn();
    String id = json.readTree(result.getResponse().getContentAsByteArray()).path("data").path("id").asText();
    String hash = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
        .digest("original".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    assertThat(jdbc.queryForObject("select content_sha256 from attachments where id=?", String.class, id)).isEqualTo(hash);
    assertThat(jdbc.queryForObject("select content_size from attachments where id=?", Long.class, id)).isEqualTo(8);
    org.mockito.Mockito.when(storage.get(key)).thenReturn(new com.procurement.common.storage.ObjectStorageService.StoredObject("original".getBytes(), "text/plain"));
    String checkUrl = "/api/v1/buyer/attachments/" + id + "/integrity-check";
    assertThat(financeCall(token, "POST", checkUrl, Map.of(), 200).path("status").asText()).isEqualTo("verified");
    org.mockito.Mockito.when(storage.get(key)).thenReturn(new com.procurement.common.storage.ObjectStorageService.StoredObject("modified".getBytes(), "text/plain"));
    assertThat(financeCall(token, "POST", checkUrl, Map.of(), 200).path("status").asText()).isEqualTo("mismatch");
    http.perform(get("/api/v1/buyer/attachments/" + id + "/download").header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
    jdbc.update("update roles set permissions='[]'::jsonb where id=?", role);
    org.mockito.Mockito.clearInvocations(storage);
    financeCall(token, "POST", checkUrl, Map.of(), 403);
    org.mockito.Mockito.verifyNoInteractions(storage);
  }

  private com.fasterxml.jackson.databind.JsonNode issueTicket(String token, String demandId) throws Exception {
    var response = http.perform(post("/api/v1/buyer/attachments/upload-ticket").header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
            "ownerType", "purchase_demand", "ownerId", demandId, "fileName", "test.txt", "visibility", "buyer_internal"))))
        .andExpect(status().isOk()).andReturn();
    return json.readTree(response.getResponse().getContentAsString()).path("data");
  }

  @Test
  void foreignAttachmentKeysAreDeniedOnRegistrationAndLegacyDownloads() throws Exception {
    String token = login();
    String key = "other-tenant/private/secret.txt";
    http.perform(post("/api/v1/buyer/attachments").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                "ownerType", "demand", "ownerId", "test", "fileName", "secret.txt", "storageKey", key))))
        .andExpect(status().isForbidden());
    String attachment = "att-" + UUID.randomUUID();
    jdbc.update("""
        insert into attachments (id,tenant_id,owner_type,owner_id,file_name,storage_key,uploaded_by,visibility,status)
        values (?,?,'demand','test','secret.txt',?,?,'private','active')
        """, attachment, tenant, key, user);
    http.perform(get("/api/v1/buyer/attachments/{id}/download", attachment)
            .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    http.perform(post("/api/v1/buyer/attachments/{id}/download-link", attachment)
            .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
  }

  @Test
  void listRetainsItemsAndLatestActiveRfqAfterBatchLoading() throws Exception {
    String first = "first-" + user;
    String second = "second-" + user;
    insertDemand(first, user);
    insertDemand(second, user);
    String material = "mat-" + user;
    jdbc.update("""
        insert into materials (id,tenant_id,code,name,category,unit,reference_price)
        values (?,?,'MAT','Laptop','Office','unit',100)
        """, material, tenant);
    jdbc.update("""
        insert into purchase_demand_items (id,tenant_id,demand_id,material_id,quantity)
        values (?, ?, ?, ?, 2), (?, ?, ?, ?, 3)
        """, "item1-" + user, tenant, first, material, "item2-" + user, tenant, second, material);
    String activeRfq = "active-" + user;
    String failedRfq = "failed-" + user;
    jdbc.update("""
        insert into rfqs (id,tenant_id,title,status,deadline_at,owner_id,created_at)
        values (?,?,'Active','报价中',now(),?,now() - interval '1 day'),
               (?,?,'Failed','已流标',now(),?,now())
        """, activeRfq, tenant, user, failedRfq, tenant, user);
    jdbc.update("""
        insert into rfq_demands (id,tenant_id,rfq_id,demand_id)
        values (?,?,?,?), (?,?,?,?)
        """, "link1-" + user, tenant, activeRfq, first, "link2-" + user, tenant, failedRfq, first);
    var response = http.perform(get("/api/v1/buyer/demands").header("Authorization", "Bearer " + login()))
        .andExpect(status().isOk()).andReturn();
    var rows = json.readTree(response.getResponse().getContentAsString()).path("data");
    assertThat(rows.size()).isEqualTo(2);
    for (var row : rows) {
      assertThat(row.path("lineItems").size()).isEqualTo(1);
      assertThat(row.path("lineItems").get(0).path("materialId").asText()).isEqualTo(material);
      if (row.path("id").asText().equals(first)) {
        assertThat(row.path("linkedRfqId").asText()).isEqualTo(activeRfq);
      } else {
        assertThat(row.path("linkedRfqId").isNull()).isTrue();
      }
    }
  }

  @Test
  void demandSequencesRemainUniqueUnderConcurrentAllocationAndRespectLegacyIds() throws Exception {
    String prefix = "QA" + UUID.randomUUID().toString().replace("-", "");
    insertDemand(prefix + "017", user);
    assertThat(demands.allocateSequence(prefix)).isEqualTo(18);
    try (var executor = Executors.newFixedThreadPool(8)) {
      List<Callable<Long>> calls = new ArrayList<>();
      for (int i = 0; i < 32; i++) calls.add(() -> demands.allocateSequence(prefix));
      List<Long> allocated = new ArrayList<>();
      for (var result : executor.invokeAll(calls, 30, TimeUnit.SECONDS)) allocated.add(result.get());
      assertThat(allocated).hasSize(32).doesNotHaveDuplicates();
      assertThat(allocated).allSatisfy(value -> assertThat(value).isBetween(19L, 50L));
    }
  }

  @Test
  void financeReportsAndListsEnforceSelfDepartmentAndTenantScope() throws Exception {
    grantFinance();
    String peer = "peer-" + user;
    String otherDept = "other-" + department;
    jdbc.update("insert into departments(id,tenant_id,name,status) values (?,?,'Other','active')", otherDept, tenant);
    jdbc.update("insert into users(id,tenant_id,name,status,department_id) values (?,?,'Peer','active',?)", peer, tenant, department);
    String own = seedFinance("own", tenant, user, department, 100, "own-" + user);
    String sameDept = seedFinance("peer", tenant, peer, department, 200, "peer-" + user);
    String hidden = seedFinance("hidden", tenant, peer, otherDept, 300, "hidden-" + user);
    // Multiple demands linked to one RFQ must not multiply report totals.
    String extra = "extra-" + user;
    insertDemand(extra, user);
    jdbc.update("insert into rfq_demands(id,tenant_id,rfq_id,demand_id) values (?,?,?,?)",
        "extra-link-" + user, tenant, "r-" + own, extra);
    String otherTenant = "other-" + tenant;
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Other','starter','active')", otherTenant);
    String otherUser = "other-" + user;
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Other','active')", otherUser, otherTenant);
    String foreign = seedFinance("foreign", otherTenant, otherUser, null, 900, "foreign-" + user);
    String token = login();

    assertThat(exportRows(token, "invoices")).hasSize(2).anySatisfy(row -> assertThat(row).contains("own"));
    assertThat(exportRows(token, "reconciliation")).hasSize(2).anySatisfy(row -> assertThat(row).contains(own));
    assertThat(exportRows(token, "procurement-analytics")).contains(List.of("合计", "1", "100.00"));
    for (String endpoint : List.of("invoices", "invoice-reconciliations", "payment-requests",
        "three-way-matches", "variance-handlings", "payment-batches", "payment-execution-records")) {
      var result = http.perform(get("/api/v1/buyer/" + endpoint).header("Authorization", "Bearer " + token))
          .andExpect(status().isOk()).andReturn();
      var data = json.readTree(result.getResponse().getContentAsString()).path("data");
      assertThat(data.size()).as(endpoint).isEqualTo(1);
      assertThat(data.toString()).doesNotContain(hidden, sameDept, foreign);
    }
    assertThat(jdbc.queryForObject("select count(*) from payment_execution_records where invoice_id = ?",
        Integer.class, hidden)).isZero();
    jdbc.update("update roles set data_scope='department' where id=?", role);
    assertThat(exportRows(token, "invoices")).hasSize(3);
    assertThat(exportRows(token, "reconciliation")).hasSize(3);
    assertThat(exportRows(token, "procurement-analytics")).contains(List.of("合计", "2", "300.00"));
    jdbc.update("update roles set data_scope='all' where id=?", role);
    assertThat(exportRows(token, "invoices")).hasSize(4);
    assertThat(exportRows(token, "procurement-analytics")).contains(List.of("合计", "3", "600.00"));
    var pdf = http.perform(get("/api/v1/buyer/reports/invoices").param("format", "pdf")
        .header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
    assertThat(new String(pdf.getResponse().getContentAsByteArray(), 0, 4, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("%PDF");
    http.perform(get("/api/v1/buyer/reports/invoices").param("format", "csv")
        .header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
    jdbc.update("update roles set data_scope='department' where id=?", role);
    jdbc.update("update users set department_id=null where id=?", user);
    assertThat(exportRows(token, "invoices")).hasSize(1);
    assertThat(exportRows(token, "procurement-analytics")).contains(List.of("合计", "0", "0"));
    jdbc.update("update roles set permissions='[]'::jsonb where id=?", role);
    for (String report : List.of("invoices", "reconciliation", "procurement-analytics")) {
      http.perform(get("/api/v1/buyer/reports/" + report).header("Authorization", "Bearer " + token))
          .andExpect(status().isForbidden());
    }
  }

  @Test
  void mixedBatchesAndOutOfScopeFinanceWritesAreRejectedWithoutSideEffects() throws Exception {
    grantFinance();
    String peer = "peer-" + user;
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Peer','active')", peer, tenant);
    String batch = "mixed-" + user;
    String own = seedFinance("own", tenant, user, department, 100, batch);
    String hidden = seedFinance("hidden", tenant, peer, department, 200, batch);
    String exception = "ex-" + user;
    jdbc.update("""
        insert into payment_archive_exception_requests(id,tenant_id,payment_batch_no,exception_type,
        exception_reason,approval_status,requested_by) values (?,?,?,'Correction','Test','已通过',?)
        """, exception, tenant, batch, peer);
    String token = login();
    for (String endpoint : List.of("payment-batches", "payment-archive-exception-requests")) {
      var result = http.perform(get("/api/v1/buyer/" + endpoint).header("Authorization", "Bearer " + token))
          .andExpect(status().isOk()).andReturn();
      assertThat(json.readTree(result.getResponse().getContentAsString()).path("data").size()).isZero();
    }
    http.perform(put("/api/v1/buyer/payment-batches/{batch}/status", batch)
        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
        .content("{\"batchStatus\":\"付款审批中\"}")).andExpect(status().isForbidden());
    http.perform(post("/api/v1/buyer/payment-archive-exception-requests/{id}/controlled-action", exception)
        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
        .content("{\"actionResult\":\"Unauthorized\"}")).andExpect(status().isForbidden());
    http.perform(put("/api/v1/buyer/payment-requests/{id}/status", "pr-" + hidden)
        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
        .content("{\"requestStatus\":\"付款申请审批中\"}")).andExpect(status().isForbidden());
    http.perform(put("/api/v1/buyer/variance-handlings/{id}/status", "vh-" + hidden)
        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
        .content("{\"status\":\"已处理\",\"result\":\"Unauthorized\"}")).andExpect(status().isForbidden());
    for (String action : List.of("payments", "payment-audit-logs")) {
      var req = action.equals("payments") ? post("/api/v1/buyer/invoices/{id}/" + action, hidden)
          .contentType(MediaType.APPLICATION_JSON).content("{\"paymentStatus\":\"已付款\"}")
          : get("/api/v1/buyer/invoices/{id}/" + action, hidden);
      http.perform(req.header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }
    http.perform(get("/api/v1/buyer/three-way-matches/{id}/lines", hidden)
        .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    assertThat(jdbc.queryForObject("select payment_status from invoices where id=?", String.class, hidden)).isEqualTo("待付款");
    assertThat(jdbc.queryForObject("select action_status from payment_archive_exception_requests where id=?", String.class, exception)).isEqualTo("待处理");
    assertThat(jdbc.queryForObject("select status from variance_handlings where id=?", String.class, "vh-" + hidden)).isEqualTo("待处理");
    // A visible invoice cannot bypass the visibility requirement of its mixed batch.
    http.perform(post("/api/v1/buyer/invoices/{id}/payments", own)
        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
        .content("{\"paymentStatus\":\"已付款\"}")).andExpect(status().isForbidden());
    own = seedFinance("allowed", tenant, user, department, 100, "allowed-" + user);
    seedVerifiedFinanceEvidence(own, 100);
    http.perform(post("/api/v1/buyer/invoices/{id}/payments", own)
        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
        .content("{\"paymentStatus\":\"已付款\",\"releaseEvidenceNo\":\"ALLOWED-RECEIPT\"}")).andExpect(status().isOk());
    assertThat(jdbc.queryForObject("select payment_status from invoices where id=?", String.class, own)).isEqualTo("已付款");
    jdbc.update("update roles set permissions='[\"buyer:invoice:read\"]'::jsonb where id=?", role);
    http.perform(post("/api/v1/buyer/invoices/{id}/payments", own)
        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
        .content("{\"paymentStatus\":\"已付款\"}")).andExpect(status().isForbidden());
  }


  @Test
  void financeWorkflowRunsRequestBatchAndArchiveExceptionWithoutLegacyTasks() throws Exception {
    String reviewer = configureFinanceReviewer();
    String token = login();
    String reviewerToken = loginAs(reviewer);
    publishFinanceWorkflow(token, "payment_request", reviewer, 1);
    publishFinanceWorkflow(token, "payment_batch", reviewer, 1);
    publishFinanceWorkflow(token, "payment_archive_exception", reviewer, 2);
    String batch = "WF-" + user;
    String invoice = seedFinance("workflow", tenant, user, department, 1200, batch);
    seedVerifiedFinanceEvidence(invoice, 1200);
    String requestId = "pr-" + invoice;
    jdbc.update("update payment_requests set request_status='付款申请待提交' where id=?", requestId);
    jdbc.update("update payment_batches set batch_status='付款申请待提交' where tenant_id=? and payment_batch_no=?", tenant, batch);

    String requestUrl = "/api/v1/buyer/payment-requests/" + requestId + "/status";
    financeCall(token, "PUT", requestUrl, Map.of("requestStatus", "付款申请已通过"), 400);
    financeCall(token, "PUT", requestUrl, Map.of("requestStatus", "付款申请审批中", "formData", Map.of("reason", "Invoice checked")), 200);
    financeCall(token, "PUT", requestUrl, Map.of("requestStatus", "付款申请待提交"), 400);
    financeCall(token, "POST", "/api/v1/buyer/payment-requests",
        Map.of("invoiceId", invoice, "requestStatus", "付款申请待提交", "paymentBatchNo", batch), 400);
    String task = financeTask(reviewerToken, "payment_request", requestId);
    financeCall(token, "POST", "/api/v1/buyer/workflow/tasks/" + task + "/complete",
        Map.of("action", "approve", "comment", "Unauthorized"), 403);
    financeCall(reviewerToken, "POST", "/api/v1/buyer/workflow/tasks/" + task + "/complete",
        Map.of("action", "approve", "comment", "Invoice approved"), 200);
    assertThat(jdbc.queryForObject("select request_status from payment_requests where id=?", String.class, requestId))
        .isEqualTo("付款申请已通过");
    assertFinanceBatch(batch, "待提交审批");

    String batchUrl = "/api/v1/buyer/payment-batches/" + batch + "/status";
    financeCall(token, "PUT", batchUrl, Map.of("batchStatus", "审批中", "formData", Map.of("reason", "Batch checked")), 200);
    financeCall(token, "PUT", batchUrl, Map.of("batchStatus", "可安排付款"), 400);
    completeFinanceTask(reviewerToken, "payment_batch", batch, "reject");
    assertFinanceBatch(batch, "待提交审批");
    financeCall(token, "PUT", batchUrl, Map.of("batchStatus", "审批中", "formData", Map.of("reason", "Rechecked")), 200);
    completeFinanceTask(reviewerToken, "payment_batch", batch, "approve");
    assertFinanceBatch(batch, "可安排付款");
    financeCall(token, "PUT", batchUrl, Map.of("batchStatus", "已付款归档"), 400);
    String executionId = jdbc.queryForObject("select id from payment_execution_records where payment_request_id=?", String.class, requestId);
    financeCall(token, "POST", "/api/v1/buyer/payment-execution-records/" + executionId + "/registration",
        Map.of("paymentStatus", "已付款", "releaseEvidenceNo", "TEST-RECEIPT"), 200);
    financeCall(token, "PUT", batchUrl, Map.of("batchStatus", "已付款归档"), 200);
    assertFinanceBatch(batch, "已付款归档");

    var exception = financeCall(token, "POST", "/api/v1/buyer/payment-archive-exception-requests",
        Map.of("paymentBatchNo", batch, "exceptionType", "更正说明", "exceptionReason", "Correct archive evidence",
            "formData", Map.of("reason", "Evidence correction")), 200);
    String exceptionId = exception.path("id").asText();
    String approvalUrl = "/api/v1/buyer/payment-archive-exception-requests/" + exceptionId + "/approval";
    financeCall(token, "POST", approvalUrl, Map.of("approved", true, "comment", "Not assignee"), 400);
    var first = financeCall(reviewerToken, "POST", approvalUrl, Map.of("approved", true, "comment", "First review"), 200);
    assertThat(first.path("status").asText()).isEqualTo("审批中");
    assertThat(jdbc.queryForObject("select approval_status from payment_archive_exception_requests where id=?", String.class, exceptionId))
        .isEqualTo("待审批");
    financeCall(token, "POST", "/api/v1/buyer/payment-archive-exception-requests/" + exceptionId + "/controlled-action",
        Map.of("actionResult", "Too early"), 400);
    var last = financeCall(reviewerToken, "POST", approvalUrl, Map.of("approved", true, "comment", "Final review"), 200);
    assertThat(last.path("status").asText()).isEqualTo("已通过");
    assertThat(jdbc.queryForObject("select reviewed_by from payment_archive_exception_requests where id=?", String.class, exceptionId))
        .isEqualTo(reviewer);
    financeCall(reviewerToken, "POST", approvalUrl, Map.of("approved", true), 400);
    financeCall(token, "POST", "/api/v1/buyer/payment-archive-exception-requests/" + exceptionId + "/controlled-action",
        Map.of("actionResult", "Evidence checked"), 200);
    financeCall(token, "POST", "/api/v1/buyer/payment-archive-exception-requests/" + exceptionId + "/closure",
        Map.of("closureResult", "Closed after review"), 200);
    assertFinanceBatch(batch, "已付款归档");
    assertThat(jdbc.queryForObject("select count(*) from approval_tasks where tenant_id=?", Integer.class, tenant)).isZero();
    assertThat(jdbc.queryForObject("""
        select count(*) from workflow_task_events where tenant_id=? and actor_id=? and action='approved'
        """, Integer.class, tenant, reviewer)).isEqualTo(4);
    assertThat(jdbc.queryForObject("""
        select actor_id from audit_logs where tenant_id=? and action='payment_archive_exception.approved'
        """, String.class, tenant)).isEqualTo(reviewer);
  }

  @Test
  void financeWorkflowStartFailureRollsBackBusinessRowsAndAudit() throws Exception {
    String reviewer = configureFinanceReviewer();
    String token = login();
    for (String type : List.of("payment_request", "payment_batch", "payment_archive_exception")) {
      publishFinanceWorkflow(token, type, reviewer, 1);
    }
    String batch = "ROLLBACK-" + user;
    String invoice = seedFinance("rollback", tenant, user, department, 100, batch);
    String requestId = "pr-" + invoice;
    jdbc.update("update payment_requests set request_status='付款申请待提交' where id=?", requestId);
    jdbc.update("update payment_batches set batch_status='付款申请待提交' where tenant_id=? and payment_batch_no=?", tenant, batch);
    // The published definition requires a reason. A missing field must roll back every business write.
    financeCall(token, "PUT", "/api/v1/buyer/payment-requests/" + requestId + "/status",
        Map.of("requestStatus", "付款申请审批中"), 400);
    assertThat(jdbc.queryForObject("select request_status from payment_requests where id=?", String.class, requestId))
        .isEqualTo("付款申请待提交");
    assertFinanceBatch(batch, "付款申请待提交");
    assertThat(jdbc.queryForObject("select count(*) from payment_execution_records where tenant_id=?", Integer.class, tenant)).isZero();

    jdbc.update("update payment_requests set request_status='付款申请已通过' where id=?", requestId);
    jdbc.update("""
        update payment_batches set batch_status='待提交审批', request_count=1,total_amount=100,approved_amount=100
        where tenant_id=? and payment_batch_no=?
        """, tenant, batch);
    financeCall(token, "PUT", "/api/v1/buyer/payment-batches/" + batch + "/status", Map.of("batchStatus", "审批中"), 400);
    assertFinanceBatch(batch, "待提交审批");
    jdbc.update("update payment_batches set batch_status='已付款归档' where tenant_id=? and payment_batch_no=?", tenant, batch);
    financeCall(token, "POST", "/api/v1/buyer/payment-archive-exception-requests",
        Map.of("paymentBatchNo", batch, "exceptionType", "Correction", "exceptionReason", "Missing form"), 400);
    assertThat(jdbc.queryForObject("select count(*) from payment_archive_exception_requests where tenant_id=?", Integer.class, tenant)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from workflow_business_instances where tenant_id=?", Integer.class, tenant)).isZero();
    assertThat(jdbc.queryForObject("select count(*) from approval_tasks where tenant_id=?", Integer.class, tenant)).isZero();
    assertThat(jdbc.queryForObject("""
        select count(*) from audit_logs where tenant_id=?
        and action in ('payment_request.submitted','payment_batch.submitted','payment_archive_exception.requested')
        """, Integer.class, tenant)).isZero();
  }

  private String configureFinanceReviewer() {
    grantFinance();
    jdbc.update("update roles set permissions='[\"buyer:*\"]'::jsonb,data_scope='all' where id=?", role);
    String reviewer = "reviewer-" + user;
    jdbc.update("""
        insert into users(id,tenant_id,name,status,department_id,password_hash)
        values (?,?,'Finance reviewer','active',?,?)
        """, reviewer, tenant, department, passwords.encode("Quality-Test-123!"));
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)", reviewer, role);
    return reviewer;
  }

  private void publishFinanceWorkflow(String token, String type, String reviewer, int steps) throws Exception {
    var created = financeCall(token, "POST", "/api/v1/buyer/process-definitions",
        Map.of("name", "Finance " + type, "businessType", type), 201);
    String id = created.path("id").asText();
    List<Map<String, Object>> nodes = new ArrayList<>();
    for (int n = 1; n <= steps; n++) {
      nodes.add(Map.of("id", "review_" + n, "type", "approver", "title", "Review " + n,
          "assignment", Map.of("type", "user", "userId", reviewer)));
    }
    financeCall(token, "PUT", "/api/v1/buyer/process-definitions/" + id,
        Map.of("name", "Finance " + type, "businessType", type, "status", "draft",
            "formSchema", "{\"fields\":[{\"id\":\"reason\",\"type\":\"text\",\"label\":\"Reason\",\"required\":true}]}",
            "flowSchema", json.writeValueAsString(Map.of("steps", nodes))), 200);
    financeCall(token, "POST", "/api/v1/buyer/process-definitions/" + id + "/publish", Map.of(), 200);
  }

  private String financeTask(String token, String type, String businessId) throws Exception {
    var result = http.perform(get("/api/v1/buyer/workflow/tasks").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk()).andReturn();
    for (var task : json.readTree(result.getResponse().getContentAsString()).path("data")) {
      if (type.equals(task.path("businessType").asText()) && businessId.equals(task.path("businessId").asText())) {
        return task.path("taskId").asText();
      }
    }
    throw new AssertionError("Missing Flowable task for " + type + ":" + businessId);
  }

  private void completeFinanceTask(String token, String type, String businessId, String action) throws Exception {
    financeCall(token, "POST", "/api/v1/buyer/workflow/tasks/" + financeTask(token, type, businessId) + "/complete",
        Map.of("action", action, "comment", "Finance review " + action), 200);
  }

  private void assertFinanceBatch(String batch, String expected) {
    assertThat(jdbc.queryForObject("select batch_status from payment_batches where tenant_id=? and payment_batch_no=?",
        String.class, tenant, batch)).isEqualTo(expected);
  }

  private com.fasterxml.jackson.databind.JsonNode financeCall(
      String token, String method, String url, Map<String, ?> body, int expected) throws Exception {
    var request = method.equals("PUT") ? put(url) : post(url);
    var result = http.perform(request.header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
        .andExpect(status().is(expected)).andReturn();
    return json.readTree(result.getResponse().getContentAsByteArray()).path("data");
  }

  @Test
  void allInvoicePaymentEntrypointsEnforceApprovalAndCurrentMatch() throws Exception {
    grantFinance();
    String token = login();
    int scenario = 0;
    for (String method : List.of("POST", "PUT")) {
      for (String problem : List.of("request-missing", "request-pending", "request-amount", "batch-pending", "batch-archived", "receipt-missing")) {
        String batch = "gate-" + scenario + "-" + user;
        String invoice = seedFinance("gate" + scenario++, tenant, user, department, 100, batch);
        seedVerifiedFinanceEvidence(invoice, 100);
        switch (problem) {
          case "request-missing" -> jdbc.update("delete from payment_requests where invoice_id=?", invoice);
          case "request-pending" -> jdbc.update("update payment_requests set request_status='付款申请审批中' where invoice_id=?", invoice);
          case "request-amount" -> jdbc.update("update payment_requests set amount=90 where invoice_id=?", invoice);
          case "batch-pending" -> jdbc.update("update payment_batches set batch_status='审批中' where tenant_id=? and payment_batch_no=?", tenant, batch);
          case "batch-archived" -> jdbc.update("update payment_batches set batch_status='已付款归档' where tenant_id=? and payment_batch_no=?", tenant, batch);
          // Keep the order's received flag: actual missing evidence must still block payment.
          case "receipt-missing" -> jdbc.update("delete from receipts where tenant_id=? and order_id=?", tenant, "o-" + invoice);
          default -> throw new AssertionError(problem);
        }
        String url = "/api/v1/buyer/invoices/" + invoice + (method.equals("POST") ? "/payments" : "");
        financeCall(token, method, url, Map.of("paymentStatus", "已付款"), 400);
        assertThat(jdbc.queryForObject("select payment_status from invoices where id=?", String.class, invoice)).isEqualTo("待付款");
        assertThat(jdbc.queryForObject("select count(*) from audit_logs where target_id=? and action='invoice.paid'", Integer.class, invoice)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from payment_execution_records where invoice_id=?", Integer.class, invoice)).isZero();
      }
      String invoice = seedFinance("valid" + method, tenant, user, department, 100, "valid-" + method + user);
      seedVerifiedFinanceEvidence(invoice, 100);
      financeCall(token, method, "/api/v1/buyer/invoices/" + invoice + (method.equals("POST") ? "/payments" : ""),
          method.equals("POST") ? Map.of("paymentStatus", "已付款", "releaseEvidenceNo", "VALID-" + method)
              : Map.of("paymentStatus", "已付款"), 200);
      assertThat(jdbc.queryForObject("select execution_status from payment_execution_records where invoice_id=?", String.class, invoice)).isEqualTo("已登记付款");
      assertThat(jdbc.queryForObject("select sum(amount) from invoice_payment_entries where tenant_id=? and invoice_id=?",
          java.math.BigDecimal.class, tenant, invoice)).isEqualByComparingTo("100");
      financeCall(token, method, "/api/v1/buyer/invoices/" + invoice + (method.equals("POST") ? "/payments" : ""),
          Map.of("paymentStatus", "已付款"), 400);
      assertThat(jdbc.queryForObject("select count(*) from audit_logs where target_id=? and action='invoice.paid'", Integer.class, invoice)).isEqualTo(1);
    }
  }

  @Test
  void contractConditionsCannotBeBypassedAndPaidMilestonesFollowFinance() throws Exception {
    grantFinance();
    jdbc.update("update roles set permissions=permissions || '[\"buyer:contract:read\",\"buyer:contract:manage\"]'::jsonb where id=?", role);
    String invoice = seedFinance("contract", tenant, user, department, 100, "contract-" + user);
    seedVerifiedFinanceEvidence(invoice, 100);
    String contract = "c-" + invoice;
    jdbc.update("""
        insert into contracts(id,tenant_id,contract_no,contract_name,related_order_id,supplier_id,amount,status)
        values (?,?,?,'Payment policy',?,?,100,'草案')
        """, contract, tenant, contract, "o-" + invoice, "s-" + invoice);
    String token = login();
    String paymentUrl = "/api/v1/buyer/invoices/" + invoice + "/payments";
    String scheduleUrl = "/api/v1/buyer/contracts/" + contract + "/payment-milestones";
    financeCall(token, "POST", paymentUrl, Map.of("paymentStatus", "已付款"), 400);
    // Explicit approved-contract precondition for payment policy tests, not a status-update API bypass.
    jdbc.update("update contracts set status='已生效',archive_status='已归档' where id=?", contract);
    financeCall(token, "POST", paymentUrl, Map.of("paymentStatus", "已付款"), 400);
    jdbc.update("update contracts set archive_status='未归档' where id=?", contract);
    var generated = financeCall(token, "POST", scheduleUrl + "/generate", Map.of(), 200);
    assertThat(generated.size()).isEqualTo(3);
    String firstId = generated.get(0).path("id").asText();
    financeCall(token, "POST", paymentUrl, Map.of("paymentStatus", "已付款"), 400);
    financeCall(token, "POST", scheduleUrl + "/" + firstId + "/pay", Map.of(), 400);
    // The same endpoint is denied for read-only users and unrelated record owners.
    jdbc.update("update roles set permissions='[\"buyer:contract:read\"]'::jsonb where id=?", role);
    financeCall(token, "POST", scheduleUrl + "/" + firstId + "/reach", Map.of(), 403);
    jdbc.update("update roles set permissions='[\"buyer:*\"]'::jsonb where id=?", role);
    String peer = "contract-peer-" + user;
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Peer','active')", peer, tenant);
    jdbc.update("update rfqs set owner_id=? where id=?", peer, "r-" + invoice);
    financeCall(token, "POST", scheduleUrl + "/" + firstId + "/reach", Map.of(), 403);
    http.perform(get(scheduleUrl).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    jdbc.update("update rfqs set owner_id=? where id=?", user, "r-" + invoice);
    for (var milestone : generated) {
      financeCall(token, "POST", scheduleUrl + "/" + milestone.path("id").asText() + "/reach", Map.of(), 200);
    }
    financeCall(token, "POST", paymentUrl, Map.of("paymentStatus", "部分付款"), 400);
    jdbc.update("update contract_payment_milestones set amount=31 where id=?", firstId);
    financeCall(token, "POST", paymentUrl, Map.of("paymentStatus", "已付款"), 400);
    jdbc.update("update contract_payment_milestones set amount=30 where id=?", firstId);
    assertThat(jdbc.queryForObject("select payment_status from invoices where id=?", String.class, invoice)).isEqualTo("待付款");
    assertThat(jdbc.queryForObject("select count(*) from contract_payment_milestones where contract_id=? and status='已付'", Integer.class, contract)).isZero();
    // Fail the second milestone write after the invoice and first milestone changed.
    // This constraint exists only in the disposable Testcontainers database.
    String failId = generated.get(1).path("id").asText().replace("'", "''");
    jdbc.execute("alter table contract_payment_milestones add constraint quality_payment_sync_failure check (id <> '" + failId + "' or status <> '已付')");
    try {
      org.assertj.core.api.Assertions.assertThatThrownBy(() ->
          financeCall(token, "POST", paymentUrl, Map.of("paymentStatus", "已付款", "releaseEvidenceNo", "CONTRACT-ROLLBACK"), 500))
          .hasRootCauseInstanceOf(org.postgresql.util.PSQLException.class);
      assertThat(jdbc.queryForObject("select payment_status from invoices where id=?", String.class, invoice)).isEqualTo("待付款");
      assertThat(jdbc.queryForObject("select count(*) from contract_payment_milestones where contract_id=? and status='已付'", Integer.class, contract)).isZero();
      assertThat(jdbc.queryForObject("select count(*) from audit_logs where target_id in (?,?) and action in ('invoice.paid','contract.milestone_paid_from_invoice')", Integer.class, contract, invoice)).isZero();
      assertThat(jdbc.queryForObject("select count(*) from payment_execution_records where invoice_id=?", Integer.class, invoice)).isZero();
    } finally {
      jdbc.execute("alter table contract_payment_milestones drop constraint quality_payment_sync_failure");
    }
    financeCall(token, "POST", paymentUrl, Map.of("paymentStatus", "已付款", "releaseEvidenceNo", "CONTRACT-PAID"), 200);
    assertThat(jdbc.queryForObject("select count(*) from contract_payment_milestones where contract_id=? and status='已付' and paid_at is not null", Integer.class, contract)).isEqualTo(3);
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where target_id=? and action='contract.milestone_paid_from_invoice' and actor_id=?", Integer.class, contract, user)).isEqualTo(3);
    assertThat(jdbc.queryForObject("select execution_status from payment_execution_records where invoice_id=?", String.class, invoice)).isEqualTo("已登记付款");
  }

  @Test
  void paymentAmountsAreIdempotentBoundedReversibleAndScoped() throws Exception {
    grantFinance();
    String invoice = seedFinance("amount", tenant, user, department, 100, "AMT-" + user);
    seedVerifiedFinanceEvidence(invoice, 100);
    String token = login();
    String url = "/api/v1/buyer/invoices/" + invoice + "/payment-ledger";
    var first = financeCall(token, "POST", url, Map.of("idempotencyKey", "one", "amount", 30, "evidenceNo", "BANK-1"), 200);
    assertThat(first.path("paidAmount").decimalValue()).isEqualByComparingTo("30");
    assertThat(first.path("remainingAmount").decimalValue()).isEqualByComparingTo("70");
    String entry = first.path("entries").get(0).path("id").asText();
    financeCall(token, "POST", url, Map.of("idempotencyKey", "one", "amount", 30, "evidenceNo", "BANK-1"), 200);
    financeCall(token, "POST", url, Map.of("idempotencyKey", "one", "amount", 31, "evidenceNo", "BANK-1"), 400);
    for (Object amount : List.of(0, -1, 71, new java.math.BigDecimal("0.001"))) {
      financeCall(token, "POST", url, Map.of("idempotencyKey", "bad", "amount", amount, "evidenceNo", "BAD"), 400);
    }
    financeCall(token, "POST", url, Map.of("idempotencyKey", "two", "amount", 30, "evidenceNo", "BANK-2"), 200);
    assertThat(jdbc.queryForObject("select payment_status from invoices where id=?", String.class, invoice)).isEqualTo("部分付款");
    assertThat(jdbc.queryForObject("select registered_amount from payment_execution_records where invoice_id=?", java.math.BigDecimal.class, invoice)).isEqualByComparingTo("60");
    financeCall(token, "POST", url, Map.of("idempotencyKey", "three", "amount", 40, "evidenceNo", "BANK-3"), 200);
    financeCall(token, "POST", url, Map.of("idempotencyKey", "over", "amount", 1, "evidenceNo", "BANK-4"), 400);
    assertThat(jdbc.queryForObject("select payment_status from invoices where id=?", String.class, invoice)).isEqualTo("已付款");
    String reverseUrl = url + "/" + entry + "/reverse";
    financeCall(token, "POST", reverseUrl, Map.of("idempotencyKey", "reverse", "reason", "登记凭据有误"), 403);
    jdbc.update("update roles set permissions=permissions || '[\"buyer:payment:reverse\"]'::jsonb where id=?", role);
    var reversed = financeCall(token, "POST", reverseUrl, Map.of("idempotencyKey", "reverse", "reason", "登记凭据有误"), 200);
    assertThat(reversed.path("paidAmount").decimalValue()).isEqualByComparingTo("70");
    assertThat(reversed.path("entries").size()).isEqualTo(4);
    financeCall(token, "POST", reverseUrl, Map.of("idempotencyKey", "reverse", "reason", "登记凭据有误"), 200);
    financeCall(token, "POST", reverseUrl, Map.of("idempotencyKey", "again", "reason", "重复冲销"), 400);
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where target_id=? and action='invoice.payment_reversed' and actor_id=?", Integer.class, invoice, user)).isEqualTo(1);
    jdbc.update("update payment_batches set batch_status='已付款归档' where tenant_id=? and payment_batch_no=?", tenant, "AMT-" + user);
    String secondEntry = jdbc.queryForObject("select id from invoice_payment_entries where invoice_id=? and idempotency_key='two'", String.class, invoice);
    financeCall(token, "POST", url + "/" + secondEntry + "/reverse", Map.of("idempotencyKey", "archived", "reason", "不可直接冲销归档付款"), 400);
    String peer = "amount-peer-" + user;
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Peer','active')", peer, tenant);
    jdbc.update("update rfqs set owner_id=? where id=?", peer, "r-" + invoice);
    http.perform(get(url).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    financeCall(token, "POST", url, Map.of("idempotencyKey", "forbidden", "amount", 1, "evidenceNo", "BAD"), 403);
  }

  @Test
  void installmentsUseOnlyReachedAmountsAndReverseTheirOriginalAllocations() throws Exception {
    grantFinance();
    jdbc.update("update roles set permissions='[\"buyer:*\"]'::jsonb where id=?", role);
    String invoice = seedFinance("installment", tenant, user, department, 100, "INST-" + user);
    seedVerifiedFinanceEvidence(invoice, 100);
    String contract = "c-" + invoice;
    jdbc.update("insert into contracts(id,tenant_id,contract_no,contract_name,related_order_id,supplier_id,amount,status) values (?,?,?,'Installments',?,?,100,'已生效')",
        contract, tenant, contract, "o-" + invoice, "s-" + invoice);
    String token = login();
    String schedule = "/api/v1/buyer/contracts/" + contract + "/payment-milestones";
    var milestones = financeCall(token, "POST", schedule + "/generate", Map.of(), 200);
    String first = milestones.get(0).path("id").asText();
    String url = "/api/v1/buyer/invoices/" + invoice + "/payment-ledger";
    financeCall(token, "POST", url, Map.of("idempotencyKey", "not-reached", "amount", 1, "evidenceNo", "BAD"), 400);
    financeCall(token, "POST", schedule + "/" + first + "/reach", Map.of(), 200);
    var paid = financeCall(token, "POST", url, Map.of("idempotencyKey", "p1", "amount", 20, "milestoneId", first, "evidenceNo", "B1"), 200);
    assertThat(jdbc.queryForObject("select status from contract_payment_milestones where id=?", String.class, first)).isEqualTo("部分已付");
    financeCall(token, "POST", url, Map.of("idempotencyKey", "too-much", "amount", 11, "milestoneId", first, "evidenceNo", "BAD"), 400);
    financeCall(token, "POST", url, Map.of("idempotencyKey", "wrong-milestone", "amount", 1, "milestoneId", "foreign", "evidenceNo", "BAD"), 400);
    financeCall(token, "POST", url, Map.of("idempotencyKey", "p2", "amount", 10, "evidenceNo", "B2"), 200);
    assertThat(jdbc.queryForObject("select status from contract_payment_milestones where id=?", String.class, first)).isEqualTo("已付");
    for (int i=1;i<milestones.size();i++) financeCall(token, "POST", schedule + "/" + milestones.get(i).path("id").asText() + "/reach", Map.of(), 200);
    financeCall(token, "POST", url, Map.of("idempotencyKey", "p3", "amount", 70, "evidenceNo", "B3"), 200);
    financeCall(token, "POST", url + "/" + paid.path("entries").get(0).path("id").asText() + "/reverse",
        Map.of("idempotencyKey", "reverse", "reason", "原金额登记错误"), 200);
    assertThat(jdbc.queryForObject("select status from contract_payment_milestones where id=?", String.class, first)).isEqualTo("部分已付");
    assertThat(jdbc.queryForObject("select sum(amount) from contract_payment_allocations where milestone_id=?", java.math.BigDecimal.class, first)).isEqualByComparingTo("10");
    assertThat(jdbc.queryForObject("select count(*) from invoice_payment_entries where invoice_id=?", Integer.class, invoice)).isEqualTo(4);
  }

  @Test
  void concurrentAmountSubmissionsCannotOverpayAndLegacyStateIsNotInvented() throws Exception {
    grantFinance();
    String invoice = seedFinance("concurrent-pay", tenant, user, department, 100, "CP-" + user);
    seedVerifiedFinanceEvidence(invoice, 100);
    String token = login();
    String url = "/api/v1/buyer/invoices/" + invoice + "/payment-ledger";
    try (var pool = Executors.newFixedThreadPool(2)) {
      List<Callable<Integer>> calls = List.of(
          () -> amountCallStatus(token, url, "a", 70), () -> amountCallStatus(token, url, "b", 70));
      var futures = pool.invokeAll(calls);
      assertThat(List.of(futures.get(0).get(), futures.get(1).get())).containsExactlyInAnyOrder(200, 400);
      var retry = pool.invokeAll(List.<Callable<Integer>>of(
          () -> amountCallStatus(token, url, "same", 30), () -> amountCallStatus(token, url, "same", 30)));
      assertThat(List.of(retry.get(0).get(), retry.get(1).get())).containsOnly(200);
    }
    assertThat(jdbc.queryForObject("select sum(amount) from invoice_payment_entries where invoice_id=?", java.math.BigDecimal.class, invoice)).isEqualByComparingTo("100");
    assertThat(jdbc.queryForObject("select count(*) from invoice_payment_entries where invoice_id=?", Integer.class, invoice)).isEqualTo(2);
    String legacy = seedFinance("legacy-pay", tenant, user, department, 100, "LEG-" + user);
    jdbc.update("update invoices set payment_status='部分付款' where id=?", legacy);
    var result = http.perform(get("/api/v1/buyer/invoices/" + legacy + "/payment-ledger").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk()).andReturn();
    var data = json.readTree(result.getResponse().getContentAsByteArray()).path("data");
    assertThat(data.path("reconciliationRequired").asBoolean()).isTrue();
    assertThat(data.path("paidAmount").isNull()).isTrue();
    financeCall(token, "POST", "/api/v1/buyer/invoices/" + legacy + "/payments", Map.of("paymentStatus", "已付款"), 400);
    financeCall(token, "POST", "/api/v1/buyer/invoices/" + legacy + "/payment-ledger", Map.of("idempotencyKey", "legacy", "amount", 10, "evidenceNo", "NO"), 400);
  }

  private int amountCallStatus(String token, String url, String key, int amount) throws Exception {
    return http.perform(post(url).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(Map.of("idempotencyKey", key, "amount", amount, "evidenceNo", key))))
        .andReturn().getResponse().getStatus();
  }

  @Test
  void historicalPaymentReviewCollectsEvidenceWithoutChangingFinancialBalances() throws Exception {
    grantFinance();
    String invoice = seedFinance("review-legacy", tenant, user, department, 100, "REVIEW-" + user);
    jdbc.update("update invoices set payment_status='部分付款' where id=?", invoice);
    jdbc.update("update payment_requests set request_status='付款申请待提交' where invoice_id=?", invoice);
    String token = login();
    String url = "/api/v1/buyer/payment-reviews/" + invoice;
    var detail = json.readTree(http.perform(get(url).header("Authorization", "Bearer " + token))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
    assertThat(detail.path("invoice").path("ledgerAmount").isNull()).isTrue();
    assertThat(detail.path("invoice").path("findings").size()).isEqualTo(2);
    assertThat(detail.path("canRecord").asBoolean()).isFalse();
    var input = Map.of("idempotencyKey", "review-1", "reportedPaidAmount", 35,
        "evidenceReference", "Bank archive 2026-001", "explanation", "Awaiting verified opening balance");
    financeCall(token, "POST", url + "/notes", input, 403);
    jdbc.update("update roles set permissions=permissions || '[\"buyer:payment:reconcile\"]'::jsonb where id=?", role);
    var first = financeCall(token, "POST", url + "/notes", input, 200);
    assertThat(first.path("createdBy").asText()).isEqualTo(user);
    assertThat(first.path("snapshot").asText()).contains("待核对", "部分付款");
    assertThat(financeCall(token, "POST", url + "/notes", input, 200).path("id").asText())
        .isEqualTo(first.path("id").asText());
    financeCall(token, "POST", url + "/notes", Map.of("idempotencyKey", "review-1", "reportedPaidAmount", 36,
        "evidenceReference", "Bank archive 2026-001", "explanation", "Awaiting verified opening balance"), 400);
    financeCall(token, "POST", url + "/notes", Map.of("idempotencyKey", "invalid", "reportedPaidAmount", -1,
        "evidenceReference", "Bank", "explanation", "Invalid"), 400);
    financeCall(token, "POST", url + "/notes", Map.of("idempotencyKey", "blank",
        "evidenceReference", " ", "explanation", "Missing proof"), 400);
    financeCall(token, "POST", url + "/notes", Map.of("idempotencyKey", "unknown",
        "evidenceReference", "Archive pending", "explanation", "Amount unknown, not zero"), 200);
    assertThat(jdbc.queryForObject("select count(*) from invoice_payment_review_notes where invoice_id=?", Integer.class, invoice)).isEqualTo(2);
    assertThat(jdbc.queryForObject("select reported_paid_amount from invoice_payment_review_notes where invoice_id=? and idempotency_key='unknown'", java.math.BigDecimal.class, invoice)).isNull();
    assertThat(jdbc.queryForObject("select count(*) from invoice_payment_entries where invoice_id=?", Integer.class, invoice)).isZero();
    assertThat(jdbc.queryForObject("select payment_status from invoices where id=?", String.class, invoice)).isEqualTo("部分付款");
    assertThat(jdbc.queryForObject("select request_status from payment_requests where invoice_id=?", String.class, invoice)).isEqualTo("付款申请待提交");
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where target_id=? and action='invoice.payment_review_recorded' and actor_id=?", Integer.class, invoice, user)).isEqualTo(2);
    financeCall(token, "POST", "/api/v1/buyer/invoices/" + invoice + "/payment-ledger",
        Map.of("idempotencyKey", "not-unblocked", "amount", 10, "evidenceNo", "NO"), 400);
  }

  @Test
  void paymentReviewIsPaginatedScopedAndDoesNotLeakCachedNotesAfterPermissionChanges() throws Exception {
    grantFinance();
    String own = seedFinance("review-own", tenant, user, department, 100, "OWN-" + user);
    String peer = "review-peer-" + user;
    jdbc.update("insert into users(id,tenant_id,name,status,department_id) values (?,?,'Peer','active',?)", peer, tenant, department);
    String hidden = seedFinance("review-hidden", tenant, peer, department, 100, "HIDDEN-" + user);
    String foreignTenant = "foreign-" + tenant;
    String foreignUser = "foreign-" + user;
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Other','starter','active')", foreignTenant);
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Other','active')", foreignUser, foreignTenant);
    String foreign = seedFinance("review-foreign", foreignTenant, foreignUser, null, 100, "FOREIGN-" + user);
    String token = login();
    String listUrl = "/api/v1/buyer/payment-reviews";
    var result = json.readTree(http.perform(get(listUrl).param("pageSize", "1").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
    assertThat(result.path("total").asInt()).isEqualTo(1);
    assertThat(result.path("items").get(0).path("invoiceId").asText()).isEqualTo(own);
    http.perform(get(listUrl).param("pageSize", "26").header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
    http.perform(get(listUrl).param("page", "0").header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
    http.perform(get(listUrl + "/" + hidden).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    http.perform(get(listUrl + "/" + foreign).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    jdbc.update("update roles set permissions=permissions || '[\"buyer:payment:reconcile\"]'::jsonb where id=?", role);
    financeCall(token, "POST", listUrl + "/" + hidden + "/notes", Map.of("idempotencyKey", "hidden", "evidenceReference", "Bank", "explanation", "Denied"), 403);
    financeCall(token, "POST", listUrl + "/" + foreign + "/notes", Map.of("idempotencyKey", "foreign", "evidenceReference", "Bank", "explanation", "Denied"), 403);
    jdbc.update("update roles set data_scope='department' where id=?", role);
    result = json.readTree(http.perform(get(listUrl).param("pageSize", "1").param("page", "2").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
    assertThat(result.path("total").asInt()).isEqualTo(2);
    assertThat(result.path("items").size()).isEqualTo(1);
    result = json.readTree(http.perform(get(listUrl).param("keyword", "review-own").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
    assertThat(result.path("total").asInt()).isEqualTo(1);
    jdbc.update("update roles set permissions='[]'::jsonb where id=?", role);
    http.perform(get(listUrl).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    http.perform(get(listUrl + "/" + own).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
  }

  @Test
  void paymentReviewFindsContractAndBatchInconsistencyWithoutInventingAmounts() throws Exception {
    grantFinance();
    String invoice = seedFinance("review-contract", tenant, user, department, 100, "CONTRACT-" + user);
    String contract = "c-" + invoice;
    jdbc.update("insert into contracts(id,tenant_id,contract_no,contract_name,related_order_id,supplier_id,amount,status) values (?,?,?,'Review',?,?,100,'已生效')",
        contract, tenant, contract, "o-" + invoice, "s-" + invoice);
    jdbc.update("insert into contract_payment_milestones(id,tenant_id,contract_id,name,percent,amount,sort_no,reached,status) values (?,?,?,'Historical installment',100,100,1,true,'已付')",
        "cm-" + invoice, tenant, contract);
    jdbc.update("update payment_batches set batch_status='审批中' where tenant_id=?", tenant);
    var result = json.readTree(http.perform(get("/api/v1/buyer/payment-reviews/" + invoice).header("Authorization", "Bearer " + login()))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).path("data").path("invoice");
    assertThat(result.path("findings").toString()).contains("历史合同付款", "付款批次");
    assertThat(result.path("ledgerAmount").isNull()).isTrue();
  }

  private void grantFinance() {
    jdbc.update("update tenants set enabled_features='[\"finance\"]'::jsonb where id=?", tenant);
    jdbc.update("""
        update roles set permissions='["buyer:invoice:read","buyer:payment:register","buyer:report:export","buyer:analytics:read","buyer:variance:approve"]'::jsonb
        where id=?
        """, role);
  }

  @Test
  void buyerOrdersReceiptsAndDeliveriesRespectLivePermissionsAndRecordScope() throws Exception {
    String own = seedFinance("fulfillment-own", tenant, user, department, 100, "own-" + user);
    String peer = "peer-" + user;
    String otherDept = "other-" + department;
    jdbc.update("insert into departments(id,tenant_id,name,status) values (?,?,'Other','active')", otherDept, tenant);
    jdbc.update("insert into users(id,tenant_id,name,status,department_id) values (?,?,'Peer','active',?)", peer, tenant, otherDept);
    String hidden = seedFinance("fulfillment-hidden", tenant, peer, otherDept, 200, "hidden-" + user);
    jdbc.update("update tenants set enabled_features='[\"order\"]'::jsonb where id=?", tenant);
    jdbc.update("update purchase_orders set status='已发货' where id in (?,?)", "o-" + own, "o-" + hidden);
    for (String id : List.of(own, hidden)) {
      int amount = id.equals(own) ? 100 : 200;
      jdbc.update("""
          insert into order_line_items(id,tenant_id,order_id,description,unit,quantity,unit_price,line_amount)
          values (?,?,?,'Scope test item','件',1,?,?)
          """, "ol-" + id, tenant, "o-" + id, amount, amount);
      jdbc.update("insert into deliveries(id,tenant_id,order_id,supplier_id,carrier,tracking_no,status,shipped_quantity) values (?,?,?,?,'Test','Test','已发货',1)",
          "del-" + id, tenant, "o-" + id, "s-" + id);
      jdbc.update("insert into delivery_line_items(id,tenant_id,delivery_id,order_line_id,shipped_quantity) values (?,?,?,?,1)",
          "dl-" + id, tenant, "del-" + id, "ol-" + id);
    }
    String token = login();
    for (String resource : List.of("orders", "receipts", "deliveries", "suppliers", "supplier-invitations")) {
      http.perform(get("/api/v1/buyer/" + resource).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }
    jdbc.update("""
        update roles set permissions='["buyer:demand:read","buyer:order:read","buyer:order:manage","buyer:receipt:read","buyer:receipt:manage"]'::jsonb where id=?
        """, role);
    var orders = http.perform(get("/api/v1/buyer/orders").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
    assertThat(orders.getResponse().getContentAsString()).contains("o-" + own).doesNotContain("o-" + hidden);
    var deliveries = http.perform(get("/api/v1/buyer/deliveries").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
    assertThat(deliveries.getResponse().getContentAsString()).contains("del-" + own).doesNotContain("del-" + hidden);
    Map<String, Object> date = Map.of("expectedReceiptDate", java.time.LocalDate.now().plusDays(30).toString());
    financeCall(token, "PUT", "/api/v1/buyer/orders/o-" + hidden, date, 403);
    financeCall(token, "PUT", "/api/v1/buyer/orders/o-" + own, date, 200);
    java.util.function.Function<String, Map<String, Object>> receipt = id -> Map.of(
        "result", "验收通过", "receivedQuantity", 1, "qualifiedQuantity", 1,
        "lineItems", List.of(Map.of("orderLineId", "ol-" + id, "receivedQuantity", 1, "qualifiedQuantity", 1)));
    financeCall(token, "POST", "/api/v1/buyer/orders/o-" + hidden + "/receipts", receipt.apply(hidden), 403);
    financeCall(token, "POST", "/api/v1/buyer/orders/o-" + own + "/receipts", receipt.apply(own), 201);
    assertThat(jdbc.queryForObject("select receiver_id from receipts where order_id=?", String.class, "o-" + own)).isEqualTo(user);
    assertThat(jdbc.queryForObject("select status from purchase_orders where id=?", String.class, "o-" + hidden)).isEqualTo("已发货");
    var receipts = http.perform(get("/api/v1/buyer/receipts").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
    assertThat(receipts.getResponse().getContentAsString()).contains("o-" + own).doesNotContain("o-" + hidden);
    jdbc.update("update roles set permissions='[\"buyer:order:read\",\"buyer:receipt:read\"]'::jsonb where id=?", role);
    financeCall(token, "PUT", "/api/v1/buyer/orders/o-" + own, date, 403);
    financeCall(token, "POST", "/api/v1/buyer/orders/o-" + hidden + "/receipts", receipt.apply(hidden), 403);
    jdbc.update("update roles set permissions='[]'::jsonb where id=?", role);
    http.perform(get("/api/v1/buyer/orders").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
  }

  @Test
  void departmentalOrderScopeRequiresEveryLinkedDemandAndFailsClosedWithoutDepartment() throws Exception {
    String own = seedFinance("department-own", tenant, user, department, 100, "own-" + user);
    String otherDept = "other-" + department;
    jdbc.update("insert into departments(id,tenant_id,name,status) values (?,?,'Other','active')", otherDept, tenant);
    String hidden = seedFinance("department-hidden", tenant, user, otherDept, 200, "hidden-" + user);
    jdbc.update("update roles set permissions='[\"buyer:order:read\",\"buyer:order:manage\"]'::jsonb,data_scope='department' where id=?", role);
    String token = login();
    var visible = http.perform(get("/api/v1/buyer/orders").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
    assertThat(visible.getResponse().getContentAsString()).contains("o-" + own).doesNotContain("o-" + hidden);
    jdbc.update("insert into rfq_demands(id,tenant_id,rfq_id,demand_id) values (?,?,?,?)", "mixed-" + own, tenant, "r-" + own, "d-" + hidden);
    var mixed = http.perform(get("/api/v1/buyer/orders").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
    assertThat(json.readTree(mixed.getResponse().getContentAsByteArray()).path("data")).isEmpty();
    financeCall(token, "PUT", "/api/v1/buyer/orders/o-" + own, Map.of("expectedReceiptDate", java.time.LocalDate.now().plusDays(30).toString()), 403);
    jdbc.update("update users set department_id=null where id=?", user);
    http.perform(get("/api/v1/buyer/orders").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk()).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.data").isEmpty());
    jdbc.update("update roles set data_scope='all' where id=?", role);
    var all = http.perform(get("/api/v1/buyer/orders").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
    assertThat(all.getResponse().getContentAsString()).contains("o-" + own, "o-" + hidden);
  }

  @Test
  void supplierLibraryIsTenantSharedButWritesRequirePermissionAndWorkspaceDoesNotBypassIt() throws Exception {
    String item = seedFinance("supplier-library", tenant, user, department, 100, "library-" + user);
    String relation = "rel-" + item;
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level,categories) values (?,?,?,'已准入','普通','[]'::jsonb)", relation, tenant, "s-" + item);
    String token = login();
    jdbc.update("update roles set permissions='[\"buyer:demand:read\",\"buyer:supplier:read\"]'::jsonb where id=?", role);
    var read = http.perform(get("/api/v1/buyer/suppliers").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
    assertThat(read.getResponse().getContentAsString()).contains(relation);
    financeCall(token, "POST", "/api/v1/buyer/suppliers/" + relation + "/profile", Map.of("level", "A", "categories", List.of("测试")), 403);
    financeCall(token, "POST", "/api/v1/buyer/suppliers/" + relation + "/submit", Map.of(), 403);
    jdbc.update("update roles set permissions=permissions || '[\"buyer:supplier:manage\"]'::jsonb where id=?", role);
    financeCall(token, "POST", "/api/v1/buyer/suppliers/" + relation + "/profile", Map.of("level", "A", "categories", List.of("测试")), 200);
    financeCall(token, "POST", "/api/v1/buyer/suppliers/" + relation + "/approval", Map.of("approved", true), 403);
    jdbc.update("update roles set permissions='[\"buyer:demand:read\"]'::jsonb where id=?", role);
    var workspace = http.perform(get("/api/v1/buyer/workspace").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
    var data = json.readTree(workspace.getResponse().getContentAsByteArray()).path("data");
    for (String field : List.of("suppliers", "orders", "deliveries", "users", "auditLogs")) assertThat(data.path(field)).isEmpty();
    assertThat(jdbc.queryForObject("select level from buyer_supplier_relations where id=?", String.class, relation)).isEqualTo("A");
  }

  @Test
  void supplierPrivateProfilesStayTenantScopedAndNeverOverwritePublicMaster() throws Exception {
    String tenantA = tenant;
    String userA = user;
    String roleA = role;
    jdbc.update("update roles set permissions='[\"buyer:supplier:read\",\"buyer:supplier:manage\"]'::jsonb where id=?", role);
    String tokenA = login();
    String supplier = "shared-" + user;
    jdbc.update("insert into enterprises(id,name,type) values (?,'Shared supplier','supplier')", supplier);
    jdbc.update("""
        insert into supplier_enterprises(enterprise_id,credit_code,legal_person,business_scope,
            contact_name,contact_phone,contact_email,bank_name,bank_account)
        values (?,'PUBLIC-CODE','Public legal','Public scope','Legacy contact','10000','legacy@example.test','Legacy bank','LEGACY-ACCOUNT')
        """, supplier);
    var publicBefore = jdbc.queryForMap("select * from supplier_enterprises where enterprise_id=?", supplier);
    financeCall(tokenA, "POST", "/api/v1/buyer/suppliers", Map.of(
        "supplierId", supplier, "status", "已准入", "level", "普通", "categories", List.of()), 400);
    assertThat(jdbc.queryForObject("select count(*) from buyer_supplier_relations where supplier_id=?", Integer.class, supplier)).isZero();
    var valuesA = new java.util.HashMap<String, Object>(Map.of(
        "supplierId", supplier, "status", "待准入", "level", "普通", "categories", List.of("设备")));
    for (String field : List.of("creditCode", "legalPerson", "businessScope", "contactName", "contactPhone", "contactEmail", "bankName", "bankAccount")) {
      valuesA.put(field, "A-" + field);
    }
    var createdA = financeCall(tokenA, "POST", "/api/v1/buyer/suppliers", valuesA, 201);
    String relationA = createdA.path("id").asText();
    for (String field : List.of("creditCode", "legalPerson", "businessScope", "contactName", "contactPhone", "contactEmail", "bankName", "bankAccount")) {
      assertThat(createdA.path(field).asText()).isEqualTo("A-" + field);
    }

    seedIsolatedAccount();
    jdbc.update("update roles set permissions='[\"buyer:supplier:read\",\"buyer:supplier:manage\"]'::jsonb where id=?", role);
    String tokenB = login();
    var createdB = financeCall(tokenB, "POST", "/api/v1/buyer/suppliers", Map.of(
        "supplierId", supplier, "status", "待准入", "level", "普通", "categories", List.of()), 201);
    String relationB = createdB.path("id").asText();
    assertThat(createdB.path("creditCode").asText()).isEqualTo("PUBLIC-CODE");
    for (String field : List.of("contactName", "contactPhone", "contactEmail", "bankName", "bankAccount")) {
      assertThat(createdB.path(field).isNull() || createdB.path(field).isMissingNode()).isTrue();
    }
    financeCall(tokenB, "POST", "/api/v1/buyer/suppliers/" + relationA + "/profile",
        Map.of("level", "普通", "categories", List.of(), "bankAccount", "ATTACK"), 400);

    var changed = financeCall(tokenA, "POST", "/api/v1/buyer/suppliers/" + relationA + "/profile",
        Map.of("level", "重要", "categories", List.of("设备"), "bankAccount", "", "contactName", "New A", "creditCode", ""), 200);
    assertThat(changed.path("bankAccount").asText()).isEmpty();
    assertThat(changed.path("creditCode").asText()).isEmpty();
    assertThat(changed.path("contactName").asText()).isEqualTo("New A");
    assertThat(changed.path("contactPhone").asText()).isEqualTo("A-contactPhone");
    var unchanged = financeCall(tokenA, "POST", "/api/v1/buyer/suppliers/" + relationA + "/profile",
        Map.of("level", "普通", "categories", List.of()), 200);
    assertThat(unchanged.path("contactName").asText()).isEqualTo("New A");
    assertThat(unchanged.path("bankAccount").asText()).isEmpty();
    var readB = http.perform(get("/api/v1/buyer/suppliers").header("Authorization", "Bearer " + tokenB))
        .andExpect(status().isOk()).andReturn();
    assertThat(readB.getResponse().getContentAsString()).doesNotContain("New A", "A-contactPhone", "LEGACY-ACCOUNT", "Legacy contact");
    assertThat(jdbc.queryForObject("select contact_name from buyer_supplier_relations where id=?", String.class, relationB)).isNull();
    assertThat(jdbc.queryForMap("select * from supplier_enterprises where enterprise_id=?", supplier)).isEqualTo(publicBefore);
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where tenant_id=? and actor_id=? and target_id=?",
        Integer.class, tenantA, userA, relationA)).isEqualTo(3);

    jdbc.update("update roles set permissions='[\"buyer:supplier:read\"]'::jsonb where id=?", roleA);
    financeCall(tokenA, "POST", "/api/v1/buyer/suppliers", valuesA, 403);
    financeCall(tokenA, "POST", "/api/v1/buyer/suppliers/" + relationA + "/profile",
        Map.of("level", "普通", "categories", List.of(), "contactName", "Denied"), 403);
    assertThat(jdbc.queryForObject("select contact_name from buyer_supplier_relations where id=?", String.class, relationA)).isEqualTo("New A");

    String operator = "supplier-" + user;
    seedPortalAccount(operator, "supplier-" + role, "supplier", supplier, "[\"supplier:*\"]");
    String supplierToken = portalLogin(operator, "SUPPLIER", supplier);
    var profile = http.perform(get("/api/v1/supplier/profile").header("Authorization", "Bearer " + supplierToken))
        .andExpect(status().isOk()).andReturn();
    assertThat(json.readTree(profile.getResponse().getContentAsByteArray()).path("data").path("creditCode").asText()).isEqualTo("PUBLIC-CODE");
  }

  @Test
  void analyticsAggregatesAndExportsApplyLiveRecordScopeBeforeSumming() throws Exception {
    String peer = "analytics-peer-" + user;
    String child = "child-" + department;
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Peer','active')", peer, tenant);
    jdbc.update("insert into departments(id,tenant_id,name,status,parent_id) values (?,?,'Child','active',?)", child, tenant, department);
    String own = seedFinance("analytics-own", tenant, user, department, 100, "a-" + user);
    String same = seedFinance("analytics-same", tenant, peer, department, 200, "b-" + user);
    String below = seedFinance("analytics-child", tenant, peer, child, 300, "c-" + user);
    String foreignTenant = "analytics-foreign-" + tenant;
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Foreign','starter','active')", foreignTenant);
    seedFinance("analytics-foreign", foreignTenant, user, null, 900, "foreign-" + user);
    for (String id : List.of(own, same, below)) {
      jdbc.update("insert into materials(id,tenant_id,code,name,category,unit,reference_price) values (?,?,?,'Material','Test category','unit',10)", "mat-" + id, tenant, id);
      jdbc.update("insert into purchase_demand_items(id,tenant_id,demand_id,material_id,quantity) values (?,?,?,?,1)", "item-" + id, tenant, "d-" + id, "mat-" + id);
      jdbc.update("insert into quotes(id,tenant_id,rfq_id,supplier_id,amount,tax_rate,delivery_days,status) values (?,?,?,?,120,0,1,'已提交')", "q-" + id, tenant, "r-" + id, "s-" + id);
      jdbc.update("insert into award_decisions(id,tenant_id,rfq_id,quote_id,supplier_id,amount,reason,approved_status) values (?,?,?,?,?,100,'Test','已通过')", "ad-" + id, tenant, "r-" + id, "q-" + id, "s-" + id);
      jdbc.update("update rfqs set awarded_supplier_id=? where id=?", "s-" + id, "r-" + id);
    }
    String token = login();
    buyerRead(token, "analytics/procurement", 403);
    jdbc.update("update roles set permissions='[\"buyer:analytics:read\",\"buyer:report:export\"]'::jsonb where id=?", role);
    assertAnalytics(token, 1, 100, 20, 10);
    assertThat(exportRows(token, "procurement-analytics")).contains(List.of("合计", "1", "100.00"));
    jdbc.update("update roles set data_scope='department' where id=?", role);
    assertAnalytics(token, 2, 300, 40, 20);
    // A cross-department RFQ must not reveal its whole order amount to one department.
    jdbc.update("insert into rfq_demands(id,tenant_id,rfq_id,demand_id) values (?,?,?,?)", "mixed-" + user, tenant, "r-" + same, "d-" + below);
    assertAnalytics(token, 1, 100, 20, 20);
    assertThat(exportRows(token, "procurement-analytics")).contains(List.of("合计", "1", "100.00"));
    jdbc.update("update roles set data_scope='department_and_below' where id=?", role);
    assertAnalytics(token, 3, 600, 60, 30);
    jdbc.update("update users set department_id=null where id=?", user);
    assertAnalytics(token, 0, 0, 0, 0);
    jdbc.update("update roles set data_scope='all' where id=?", role);
    assertAnalytics(token, 3, 600, 60, 30);
    jdbc.update("update roles set permissions='[\"buyer:report:export\"]'::jsonb where id=?", role);
    buyerRead(token, "analytics/procurement", 403);
    buyerRead(token, "reports/procurement-analytics", 403);
  }

  private void assertAnalytics(String token, int orders, int total, int savings, int category) throws Exception {
    var result = buyerRead(token, "analytics/procurement", 200);
    assertThat(result.path("orderCount").asInt()).isEqualTo(orders);
    assertThat(result.path("supplierCount").asInt()).isEqualTo(orders);
    assertThat(result.path("totalSpend").decimalValue()).isEqualByComparingTo(Integer.toString(total));
    assertThat(result.path("biddingSavings").decimalValue()).isEqualByComparingTo(Integer.toString(savings));
    assertThat(result.path("categorySpend").isEmpty() ? 0 : result.path("categorySpend").get(0).path("totalAmount").asInt()).isEqualTo(category);
    assertThat(result.path("statusDistribution").isEmpty() ? 0 : result.path("statusDistribution").get(0).path("orderCount").asInt()).isEqualTo(orders);
  }

  @Test
  void budgetsRequireDepartmentAuthorityAndRecordTheRealActor() throws Exception {
    String token = login();
    var body = Map.<String, Object>of("departmentId", department, "period", "2026", "totalAmount", 5000);
    buyerRead(token, "budgets", 403);
    financeCall(token, "POST", "/api/v1/buyer/budgets", body, 403);
    jdbc.update("update roles set permissions='[\"buyer:budget:read\",\"buyer:budget:manage\"]'::jsonb where id=?", role);
    assertThat(buyerRead(token, "budgets", 200).isEmpty()).isTrue();
    financeCall(token, "POST", "/api/v1/buyer/budgets", body, 403);
    jdbc.update("update roles set data_scope='department' where id=?", role);
    var saved = financeCall(token, "POST", "/api/v1/buyer/budgets", body, 200);
    assertThat(saved.path("departmentId").asText()).isEqualTo(department);
    assertThat(buyerRead(token, "budgets", 200).size()).isEqualTo(1);
    assertThat(jdbc.queryForObject("select actor_id from audit_logs where target_id=? and action='department_budget.updated'", String.class, saved.path("id").asText())).isEqualTo(user);
    String otherDept = "other-" + department;
    jdbc.update("insert into departments(id,tenant_id,name,status) values (?,?,'Other','active')", otherDept, tenant);
    financeCall(token, "POST", "/api/v1/buyer/budgets", Map.of("departmentId", otherDept, "period", "2026", "totalAmount", 1), 403);
    financeCall(token, "POST", "/api/v1/buyer/budgets", Map.of("departmentId", department, "period", "invalid", "totalAmount", 1), 400);
    jdbc.update("update roles set data_scope='all' where id=?", role);
    financeCall(token, "POST", "/api/v1/buyer/budgets", Map.of("departmentId", "foreign-or-missing", "period", "2026", "totalAmount", 1), 400);
    String foreignTenant = "budget-foreign-" + tenant;
    String foreignDept = "foreign-" + department;
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Foreign','starter','active')", foreignTenant);
    jdbc.update("insert into departments(id,tenant_id,name,status) values (?,?,'Foreign','active')", foreignDept, foreignTenant);
    financeCall(token, "POST", "/api/v1/buyer/budgets", Map.of("departmentId", foreignDept, "period", "2026", "totalAmount", 1), 400);
    financeCall(token, "POST", "/api/v1/buyer/budgets", Map.of("departmentId", otherDept, "period", "2026", "totalAmount", 1), 200);
    assertThat(buyerRead(token, "budgets", 200).size()).isEqualTo(2);
    jdbc.update("update roles set data_scope='department',permissions='[\"buyer:budget:read\"]'::jsonb where id=?", role);
    assertThat(buyerRead(token, "budgets", 200).size()).isEqualTo(1);
    financeCall(token, "POST", "/api/v1/buyer/budgets", body, 403);
  }

  @Test
  void budgetDisbursementsDoNotMultiplyWithLinkedDemandsOrInventDepartmentAllocations() throws Exception {
    jdbc.update("update roles set permissions='[\"buyer:budget:read\",\"buyer:budget:manage\"]'::jsonb,data_scope='department' where id=?", role);
    String item = seedFinance("budget", tenant, user, department, 1800, "budget-" + user);
    String duplicate = "second-" + user;
    insertDemand(duplicate, user);
    jdbc.update("update purchase_demands set budget=1200 where id=?", "d-" + item);
    jdbc.update("update purchase_demands set budget=600,status='已通过' where id=?", duplicate);
    jdbc.update("insert into rfq_demands(id,tenant_id,rfq_id,demand_id) values (?,?,?,?)", duplicate, tenant, "r-" + item, duplicate);
    String token = login();
    String period = jdbc.queryForObject("select to_char(current_date,'YYYY')", String.class);
    financeCall(token, "POST", "/api/v1/buyer/budgets", Map.of("departmentId", department, "period", period, "totalAmount", 5000), 200);
    // No contract or milestone is required; two linked demands must not multiply either ledger entry.
    jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,created_by) values (?,?,?,'budget-first',600,'bank-first',?)",
        "paid-first-" + user, tenant, item, user);
    assertThat(buyerRead(token, "budgets", 200).get(0).path("disbursed").decimalValue()).isEqualByComparingTo("600");
    jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,created_by) values (?,?,?,'budget-second',1200,'bank-second',?)",
        "paid-second-" + user, tenant, item, user);
    assertThat(buyerRead(token, "budgets", 200).get(0).path("disbursed").decimalValue()).isEqualByComparingTo("1800");
    jdbc.update("insert into contracts(id,tenant_id,contract_no,contract_name,related_order_id,supplier_id,amount,status) values (?,?,?,'Test',?,?,1800,'已生效')", "c-" + item, tenant, item, "o-" + item, "s-" + item);
    jdbc.update("insert into contract_payment_milestones(id,tenant_id,contract_id,name,percent,amount,status) values (?,?,?,'Paid',100,1800,'已付')", "cm-" + item, tenant, "c-" + item);
    assertThat(buyerRead(token, "budgets", 200).get(0).path("disbursed").decimalValue()).isEqualByComparingTo("1800");
    String other = "budget-other-" + department;
    jdbc.update("insert into departments(id,tenant_id,name,status) values (?,?,'Other','active')", other, tenant);
    jdbc.update("update purchase_demands set department_id=? where id=?", other, duplicate);
    // Explicit positive demand budgets provide a 1200:600 allocation, not exclusion of the whole project.
    assertThat(buyerRead(token, "budgets", 200).get(0).path("disbursed").decimalValue()).isEqualByComparingTo("1200");
    jdbc.update("update roles set data_scope='all' where id=?", role);
    financeCall(token, "POST", "/api/v1/buyer/budgets", Map.of("departmentId", other, "period", period, "totalAmount", 5000), 200);
    var byDepartment = new java.util.HashMap<String, com.fasterxml.jackson.databind.JsonNode>();
    buyerRead(token, "budgets", 200).forEach(row -> byDepartment.put(row.path("departmentId").asText(), row));
    assertThat(byDepartment.get(department).path("disbursed").decimalValue()).isEqualByComparingTo("1200");
    assertThat(byDepartment.get(other).path("disbursed").decimalValue()).isEqualByComparingTo("600");
    jdbc.update("insert into invoice_payment_entries(id,tenant_id,invoice_id,idempotency_key,amount,evidence_no,created_by,reversal_of) values (?,?,?,'budget-reverse',-1200,'bank-reversal',?,?)",
        "paid-reverse-" + user, tenant, item, user, "paid-second-" + user);
    buyerRead(token, "budgets", 200).forEach(row -> byDepartment.put(row.path("departmentId").asText(), row));
    assertThat(byDepartment.get(department).path("disbursed").decimalValue()).isEqualByComparingTo("400");
    assertThat(byDepartment.get(other).path("disbursed").decimalValue()).isEqualByComparingTo("200");
    // A separate historical project respects one-invoice-per-order while exposing unknown payments to both departments.
    String historical = seedFinance("budget-legacy", tenant, user, department, 1800, "budget-legacy-" + user);
    String historicalSecond = "legacy-second-" + user;
    insertDemand(historicalSecond, user);
    jdbc.update("update purchase_demands set budget=1200 where id=?", "d-" + historical);
    jdbc.update("update purchase_demands set department_id=?,budget=600,status='已通过' where id=?", other, historicalSecond);
    jdbc.update("insert into rfq_demands(id,tenant_id,rfq_id,demand_id) values (?,?,?,?)", historicalSecond, tenant, "r-" + historical, historicalSecond);
    jdbc.update("update invoices set payment_status='已付款' where id=?", historical);
    buyerRead(token, "budgets", 200).forEach(row -> {
      assertThat(row.path("disbursed").isNull() || row.path("disbursed").isMissingNode()).isTrue();
      assertThat(row.path("unverifiedPaymentCount").asInt()).isEqualTo(1);
    });
  }

  @Test
  void independentAuditRequiresExplicitPermissionAndAllDataScope() throws Exception {
    String token = login();
    String own = "audit-demand-" + user;
    insertDemand(own, user);
    assertThat(buyerRead(token, "audit-logs/target?targetType=purchase_demand&targetId=" + own, 200).isEmpty()).isTrue();
    String peer = "audit-peer-" + user;
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Peer','active')", peer, tenant);
    insertDemand("hidden-" + own, peer);
    buyerRead(token, "audit-logs/target?targetType=purchase_demand&targetId=hidden-" + own, 403);
    jdbc.update("insert into materials(id,tenant_id,code,name,category,unit) values (?,?,?,'Material','Category','unit')", "m-" + own, tenant, own);
    buyerRead(token, "audit-logs/target?targetType=material&targetId=m-" + own, 403);
    jdbc.update("update roles set permissions=permissions || '[\"buyer:material:read\"]'::jsonb where id=?", role);
    assertThat(buyerRead(token, "audit-logs/target?targetType=material&targetId=m-" + own, 200).isEmpty()).isTrue();
    buyerRead(token, "audit-logs/target?targetType=material&targetId=foreign", 403);
    buyerRead(token, "audit-logs", 403);
    buyerRead(token, "audit-logs/target?targetType=department_budget&targetId=any", 403);
    jdbc.update("update roles set permissions='[\"buyer:*\"]'::jsonb where id=?", role);
    buyerRead(token, "audit-logs", 403);
    assertThat(buyerRead(token, "workspace", 200).path("auditLogs").isEmpty()).isTrue();
    jdbc.update("update roles set data_scope='all' where id=?", role);
    var saved = financeCall(token, "POST", "/api/v1/buyer/budgets", Map.of("departmentId", department, "period", "2026", "totalAmount", 10), 200);
    assertThat(buyerRead(token, "audit-logs", 200).toString()).contains(saved.path("id").asText());
    assertThat(buyerRead(token, "audit-logs/target?targetType=department_budget&targetId=" + saved.path("id").asText(), 200).size()).isEqualTo(1);
    String foreignTenant = "audit-foreign-" + tenant;
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Foreign','starter','active')", foreignTenant);
    jdbc.update("insert into audit_logs(id,tenant_id,actor_id,action,target_type,target_id) values (?,?,?,'department_budget.updated','department_budget','foreign')", "audit-foreign-" + user, foreignTenant, user);
    assertThat(buyerRead(token, "audit-logs/target?targetType=department_budget&targetId=foreign", 200).isEmpty()).isTrue();
    assertThat(buyerRead(token, "audit-logs", 200).toString()).doesNotContain("audit-foreign-" + user);
    jdbc.update("update roles set permissions='[]'::jsonb where id=?", role);
    buyerRead(token, "audit-logs", 403);
  }

  @Test
  void mallAndTenderHttpPermissionsAreSeparatedAndRevocable() throws Exception {
    String token = login();
    for (String path : List.of("mall/listings", "mall/products", "mall/cart", "mall/addresses", "tenders")) {
      buyerRead(token, path, 403);
    }
    jdbc.update("update roles set permissions = '[\"buyer:mall:read\",\"buyer:tender:read\"]'::jsonb where id = ?", role);
    for (String path : List.of("mall/listings", "mall/products", "mall/cart", "mall/addresses", "tenders")) {
      buyerRead(token, path, 200);
    }
    for (String path : List.of("mall/products/pending-review", "mall/analytics", "mall/after-sales", "mall/reviews")) {
      buyerRead(token, path, 403);
    }
    for (String path : List.of("mall/cart/items", "mall/cart/checkout", "mall/listings", "mall/addresses", "mall/orders", "tenders")) {
      Map<String,Object> body = path.equals("mall/cart/checkout") || path.equals("mall/orders")
          ? Map.of("idempotencyKey", UUID.randomUUID().toString()) : Map.of();
      financeCall(token, "POST", "/api/v1/buyer/" + path, body, 403);
    }
    jdbc.update("update roles set permissions = '[]'::jsonb where id = ?", role);
    buyerRead(token, "mall/listings", 403);
    buyerRead(token, "tenders", 403);
  }

  @Test
  void tenderListsAndAssociatedReadsFollowCreatorScope() throws Exception {
    String peer = "peer-" + user;
    String other = "other-" + user;
    jdbc.update("insert into users(id,tenant_id,name,status,department_id) values (?,?,'Peer','active',?)", peer, tenant, department);
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Other','active')", other, tenant);
    for (String owner : List.of(user, peer, other)) {
      jdbc.update("insert into tenders(id,tenant_id,tender_no,title,tender_type,owner_id) values (?,?,?,'Scope test','公开招标',?)",
          "t-" + owner, tenant, owner, owner);
    }
    jdbc.update("update roles set permissions = '[\"buyer:tender:read\",\"buyer:tender:manage\"]'::jsonb where id = ?", role);
    String token = login();
    assertThat(buyerRead(token, "tenders", 200)).hasSize(1);
    buyerRead(token, "rfqs/t-" + user + "/announcements", 200);
    buyerRead(token, "rfqs/t-" + peer + "/announcements", 403);
    buyerRead(token, "esign-records?targetType=tender-award&targetId=t-" + peer, 403);
    financeCall(token, "POST", "/api/v1/buyer/tenders/t-" + peer + "/publish", Map.of(), 403);
    jdbc.update("update roles set data_scope = 'department' where id = ?", role);
    assertThat(buyerRead(token, "tenders", 200)).hasSize(2);
    buyerRead(token, "rfqs/t-" + peer + "/announcements", 200);
    buyerRead(token, "esign-records?targetType=tender-award&targetId=t-" + peer, 200);
    buyerRead(token, "rfqs/t-" + other + "/announcements", 403);
    jdbc.update("update roles set data_scope = 'all' where id = ?", role);
    assertThat(buyerRead(token, "tenders", 200)).hasSize(3);
    jdbc.update("update roles set permissions = '[]'::jsonb where id = ?", role);
    buyerRead(token, "rfqs/t-" + user + "/announcements", 403);
    buyerRead(token, "esign-records?targetType=tender-award&targetId=t-" + user, 403);
  }

  @Test
  void mallServiceRecordsAndAnalyticsUseOrderScopeIncludingChannelAnchors() throws Exception {
    String other = "mall-other-" + user;
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Other','active')", other, tenant);
    String own = seedFinance("mall-own", tenant, user, null, 100, "mall-own");
    String hidden = seedFinance("mall-hidden", tenant, other, null, 900, "mall-hidden");
    String unknown = seedFinance("mall-unknown", tenant, user, null, 300, "mall-unknown");
    jdbc.update("update rfqs set method = '商城' where id in (?,?)", "r-" + own, "r-" + hidden);
    for (String id : List.of(own, hidden, unknown)) {
      jdbc.update("insert into mall_after_sales(id,tenant_id,order_id,order_line_id,supplier_id,type,quantity,reason) values (?,?,?,?,?,'维修',1,'Test')",
          "a-" + id, tenant, "o-" + id, "l-" + id, "s-" + id);
      jdbc.update("insert into mall_reviews(id,tenant_id,order_id,order_line_id,supplier_id,rating) values (?,?,?,?,?,5)",
          "v-" + id, tenant, "o-" + id, "l-" + id, "s-" + id);
    }
    jdbc.update("update roles set permissions = '[\"buyer:order:read\",\"buyer:analytics:read\",\"buyer:mall:purchase\"]'::jsonb, data_scope = 'department' where id = ?", role);
    String token = login();
    assertThat(buyerRead(token, "mall/after-sales", 200)).hasSize(1);
    assertThat(buyerRead(token, "mall/reviews", 200)).hasSize(1);
    var stats = buyerRead(token, "mall/analytics", 200);
    assertThat(stats.path("totalOrders").asInt()).isEqualTo(1);
    assertThat(stats.path("totalAmount").asInt()).isEqualTo(100);
    financeCall(token, "POST", "/api/v1/buyer/mall/reviews",
        Map.of("orderId", "o-" + hidden, "orderLineId", "l-" + hidden, "rating", 5), 403);
    financeCall(token, "POST", "/api/v1/buyer/mall/after-sales",
        Map.of("orderId", "o-" + hidden, "orderLineId", "l-" + hidden, "type", "维修", "quantity", 1, "reason", "Test"), 403);
    jdbc.update("update roles set data_scope = 'all' where id = ?", role);
    assertThat(buyerRead(token, "mall/after-sales", 200)).hasSize(3);
    assertThat(buyerRead(token, "mall/analytics", 200).path("totalOrders").asInt()).isEqualTo(2);
  }

  @Test
  void productReviewsDoNotExposePrivateOrderIdentifiers() throws Exception {
    String own = seedFinance("review", tenant, user, department, 100, "review");
    String product = "product-" + user;
    jdbc.update("insert into mall_products(id,tenant_id,supplier_id,name) values (?,?,?,'Test')", product, tenant, "s-" + own);
    jdbc.update("insert into mall_reviews(id,tenant_id,order_id,order_line_id,product_id,supplier_id,rating) values (?,?,?,?,?,?,5)",
        "review-" + own, tenant, "o-" + own, "line-" + own, product, "s-" + own);
    jdbc.update("update roles set permissions = '[\"buyer:mall:read\"]'::jsonb where id = ?", role);
    String token = login();
    var rows = buyerRead(token, "mall/products/" + product + "/reviews", 200);
    assertThat(rows).hasSize(1);
    assertThat(rows.get(0).path("orderId").asText("")).isEmpty();
    assertThat(rows.get(0).path("orderLineId").asText("")).isEmpty();
    jdbc.update("update mall_products set status = '下架' where id = ?", product);
    assertThat(buyerRead(token, "mall/products/" + product + "/reviews", 200)).isEmpty();
  }

  @Test
  void authorizedMallPublishingAndCheckoutWorkAndRespectTenantCapability() throws Exception {
    jdbc.update("update tenants set enabled_features = '[\"method:mall\",\"order\"]'::jsonb where id = ?", tenant);
    jdbc.update("insert into enterprises(id,name,type) values (?,'Supplier','supplier')", "s-" + user);
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level,categories) values (?,?,?,'已准入','普通','[]'::jsonb)",
        "rel-" + user, tenant, "s-" + user);
    jdbc.update("insert into materials(id,tenant_id,code,name,category,unit) values (?,?,?,'Material','Category','件')", "m-" + user, tenant, user);
    jdbc.update("update roles set permissions = '[\"buyer:mall:read\",\"buyer:mall:manage\",\"buyer:mall:purchase\",\"buyer:order:read\"]'::jsonb, data_scope = 'department' where id = ?", role);
    String token = login();
    var listing = financeCall(token, "POST", "/api/v1/buyer/mall/listings",
        Map.of("supplierId", "s-" + user, "materialId", "m-" + user, "price", 100, "unit", "件"), 200);
    String sku = listing.path("id").asText();
    assertThat(sku).isNotEmpty();
    Map<String,Map<String,Object>> checkoutRequests = Map.of(
        "orders", Map.of("listingId", sku, "quantity", 1),
        "orders/batch", Map.of("items", List.of(Map.of("listingId", sku, "quantity", 1))),
        "cart/checkout", Map.of());
    for (var entry : checkoutRequests.entrySet()) {
      for (String key : java.util.Arrays.asList(null, "", " \t")) {
        var body = new java.util.HashMap<>(entry.getValue());
        if (key != null) body.put("idempotencyKey", key);
        var rejected = http.perform(post("/api/v1/buyer/mall/" + entry.getKey())
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(body))).andExpect(status().isBadRequest()).andReturn();
        assertThat(rejected.getResponse().getContentAsString()).contains("idempotencyKey");
      }
    }
    assertThat(buyerRead(token, "orders", 200)).isEmpty();
    financeCall(token, "POST", "/api/v1/buyer/mall/cart/items", Map.of("skuId", sku, "quantity", 2), 200);
    var placed = financeCall(token, "POST", "/api/v1/buyer/mall/cart/checkout", Map.of("idempotencyKey", UUID.randomUUID().toString()), 200);
    assertThat(placed).hasSize(1);
    assertThat(placed.get(0).path("amount").asInt()).isEqualTo(200);
    assertThat(buyerRead(token, "orders", 200)).hasSize(1);
    assertThat(buyerRead(token, "mall/cart", 200).path("itemCount").asInt()).isZero();
    financeCall(token, "POST", "/api/v1/buyer/mall/cart/items", Map.of("skuId", sku, "quantity", 1), 200);
    jdbc.update("update tenants set enabled_features = '[\"method:compare\",\"order\"]'::jsonb where id = ?", tenant);
    financeCall(token, "POST", "/api/v1/buyer/mall/cart/checkout", Map.of("idempotencyKey", UUID.randomUUID().toString()), 400);
    assertThat(buyerRead(token, "mall/cart", 200).path("itemCount").asInt()).isEqualTo(1);
    assertThat(buyerRead(token, "orders", 200)).hasSize(1);
  }

  private com.fasterxml.jackson.databind.JsonNode buyerRead(String token, String path, int expected) throws Exception {
    var result = http.perform(get("/api/v1/buyer/" + path).header("Authorization", "Bearer " + token))
        .andExpect(status().is(expected)).andReturn();
    return json.readTree(result.getResponse().getContentAsString()).path("data");
  }

  // Opt-in evidence for the exact, fully fulfilled finance scenarios above; legacy seeds remain unverified.
  private void seedVerifiedFinanceEvidence(String invoice, int amount) {
    assertThat(jdbc.queryForObject("select amount from invoices where tenant_id=? and id=?",
        java.math.BigDecimal.class, tenant, invoice)).isEqualByComparingTo(String.valueOf(amount));
    String line = "verified-ol-" + invoice;
    String delivery = "verified-del-" + invoice;
    String receipt = "verified-rec-" + invoice;
    jdbc.update("""
        insert into order_line_items(id,tenant_id,order_id,description,unit,quantity,unit_price,line_amount)
        values (?,?,?,'Verified test item','件',1,?,?)
        """, line, tenant, "o-" + invoice, amount, amount);
    jdbc.update("""
        insert into deliveries(id,tenant_id,order_id,supplier_id,carrier,tracking_no,status,shipped_quantity)
        values (?,?,?,?,'Fixture carrier',?,'已发货',1)
        """, delivery, tenant, "o-" + invoice, "s-" + invoice, "TRACK-" + invoice);
    jdbc.update("""
        insert into delivery_line_items(id,tenant_id,delivery_id,order_line_id,shipped_quantity)
        values (?,?,?,?,1)
        """, "verified-dl-" + invoice, tenant, delivery, line);
    jdbc.update("""
        insert into receipts(id,tenant_id,order_id,receiver_id,result,received_quantity,qualified_quantity,inspection_conclusion)
        values (?,?,?,?,'验收通过',1,1,'全部合格')
        """, receipt, tenant, "o-" + invoice, user);
    jdbc.update("""
        insert into receipt_line_items(id,tenant_id,receipt_id,order_line_id,description,unit,ordered_quantity,received_quantity,qualified_quantity)
        values (?,?,?,?,'Verified test item','件',1,1,1)
        """, "verified-rl-" + invoice, tenant, receipt, line);
    jdbc.update("""
        insert into invoice_line_items(id,tenant_id,invoice_id,order_line_id,description,unit,quantity,unit_price,line_amount)
        values (?,?,?,?,'Verified test item','件',1,?,?)
        """, "verified-il-" + invoice, tenant, invoice, line, amount, amount);
    // The generic seed creates a placeholder pending difference, not evidence of a real variance.
    assertThat(jdbc.update("""
        delete from variance_handlings where tenant_id=? and invoice_id=? and variance_amount=0
          and reason='Test' and result='Pending' and status='待处理'
        """, tenant, invoice)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select blocking_reason from finance_invoice_closeout_checks where tenant_id=? and invoice_id=?",
        String.class, tenant, invoice)).isNull();
  }

  private String seedFinance(String tag, String targetTenant, String owner, String dept, int amount, String batch) {
    String id = tag + "-" + user;
    jdbc.update("insert into enterprises(id,name,type) values (?,'Supplier','supplier')", "s-" + id);
    jdbc.update("insert into rfqs(id,tenant_id,title,status,deadline_at,owner_id) values (?,?,'Test','已定标',now(),?)",
        "r-" + id, targetTenant, owner);
    if (dept != null) {
      jdbc.update("""
          insert into purchase_demands(id,tenant_id,title,department_id,requester_id,budget,status)
          values (?,?,'Test',?,?,?,'已通过')
          """, "d-" + id, targetTenant, dept, owner, amount);
      jdbc.update("insert into rfq_demands(id,tenant_id,rfq_id,demand_id) values (?,?,?,?)",
          "rd-" + id, targetTenant, "r-" + id, "d-" + id);
    }
    jdbc.update("""
        insert into purchase_orders(id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date)
        values (?,?,?,?,?,'已收货',current_date)
        """, "o-" + id, targetTenant, "r-" + id, "s-" + id, amount);
    jdbc.update("""
        insert into invoices(id,tenant_id,supplier_id,order_id,amount,invoice_no,payment_status)
        values (?,?,?,?,?,?,'待付款')
        """, id, targetTenant, "s-" + id, "o-" + id, amount, tag);
    matches.upsertFromInvoice("m-" + id, targetTenant, id);
    jdbc.update("""
        insert into invoice_reconciliations(id,tenant_id,invoice_id,supplier_id,order_id,stage,next_action)
        values (?,?,?,?,?,'待付款','登记付款')
        """, "rec-" + id, targetTenant, id, "s-" + id, "o-" + id);
    jdbc.update("""
        insert into payment_requests(id,tenant_id,invoice_id,supplier_id,order_id,amount,request_status,payment_batch_no,created_by)
        values (?,?,?,?,?,?,'付款申请已通过',?,?)
        """, "pr-" + id, targetTenant, id, "s-" + id, "o-" + id, amount, batch, owner);
    jdbc.update("""
        insert into payment_batches(id,tenant_id,payment_batch_no,batch_status)
        values (?,?,?,'可安排付款') on conflict (tenant_id,payment_batch_no) do nothing
        """, "pb-" + id, targetTenant, batch);
    jdbc.update("""
        insert into variance_handlings(id,tenant_id,invoice_id,supplier_id,order_id,variance_amount,reason,owner_id,result,status,created_by)
        values (?,?,?,?,?,0,'Test',?,'Pending','待处理',?)
        """, "vh-" + id, targetTenant, id, "s-" + id, "o-" + id, owner, owner);
    return id;
  }

  private List<List<String>> exportRows(String token, String report) throws Exception {
    var result = http.perform(get("/api/v1/buyer/reports/" + report).header("Authorization", "Bearer " + token))
        .andExpect(status().isOk()).andReturn();
    try (var workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook(
        new java.io.ByteArrayInputStream(result.getResponse().getContentAsByteArray()))) {
      List<List<String>> rows = new ArrayList<>();
      for (var row : workbook.getSheetAt(0)) {
        List<String> values = new ArrayList<>();
        for (var cell : row) values.add(cell.getStringCellValue());
        rows.add(values);
      }
      return rows;
    }
  }

  private void insertDemand(String id, String requester) {
    jdbc.update("""
        insert into purchase_demands (id,tenant_id,title,department_id,requester_id,budget,status)
        values (?,?,'Original',?,?,100,'草稿')
        """, id, tenant, department, requester);
  }

  @Test
  void restrictedPlatformOperatorCanPublishButCannotManageTenantsOrBypassRevocation() throws Exception {
    String operator = "platform-" + user;
    String operatorRole = "platform-" + role;
    seedPortalAccount(operator, operatorRole, "platform", null,
        "[\"platform:announcement:read\",\"platform:announcement:manage\"]");
    String token = portalLogin(operator, "PLATFORM", null);
    financeCall(token, "POST", "/api/v1/platform/tenants/not-owned/disable", Map.of(), 403);
    http.perform(get("/api/v1/platform/workspace").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    var notice = financeCall(token, "POST", "/api/v1/platform/announcements",
        Map.of("title", "Permission acceptance", "content", "Isolated test", "audience", "all"), 201);
    String id = notice.path("id").asText();
    assertThat(id).isNotBlank();
    financeCall(token, "POST", "/api/v1/platform/announcements/" + id + "/withdraw", Map.of(), 200);
    var history = http.perform(get("/api/v1/platform/announcements").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk()).andReturn();
    assertThat(history.getResponse().getContentAsString()).contains(id).contains("withdrawn");
    var publicList = http.perform(get("/api/v1/public/announcements")).andExpect(status().isOk()).andReturn();
    assertThat(publicList.getResponse().getContentAsString()).doesNotContain(id);
    jdbc.update("update roles set permissions='[\"platform:announcement:read\"]'::jsonb where id=?", operatorRole);
    financeCall(token, "POST", "/api/v1/platform/announcements",
        Map.of("title", "Must not publish", "content", "Test", "audience", "all"), 403);
    http.perform(get("/api/v1/platform/announcements").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
    http.perform(get("/api/v1/supplier/orders").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
  }

  @Test
  void supplierOperatorIsRestrictedByPermissionAndSupplierOwnership() throws Exception {
    String invoice = seedFinance("supplier-scope", tenant, user, department, 100, "scope-batch-" + user);
    String other = seedFinance("other-supplier", tenant, user, department, 100, "other-batch-" + user);
    String order = "o-" + invoice;
    jdbc.update("update purchase_orders set status='待供应商确认' where id in (?,?)", order, "o-" + other);
    jdbc.update("update tenants set enabled_features='[\"order\"]'::jsonb where id=?", tenant);
    String operator = "supplier-" + user;
    String operatorRole = "supplier-" + role;
    seedPortalAccount(operator, operatorRole, "supplier", "s-" + invoice, "[\"supplier:order:read\"]");
    String token = portalLogin(operator, "SUPPLIER", "s-" + invoice);
    var response = http.perform(get("/api/v1/supplier/orders").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk()).andReturn();
    assertThat(response.getResponse().getContentAsString()).contains(order).doesNotContain("o-" + other);
    financeCall(token, "POST", "/api/v1/supplier/orders/" + order + "/confirm", Map.of(), 403);
    financeCall(token, "POST", "/api/v1/supplier/users/" + operator + "/password", Map.of("newPassword", "Another-Password-123!"), 403);
    http.perform(get("/api/v1/supplier/workspace").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    jdbc.update("update roles set permissions='[\"supplier:order:read\",\"supplier:order:manage\"]'::jsonb where id=?", operatorRole);
    financeCall(token, "POST", "/api/v1/supplier/orders/o-" + other + "/confirm", Map.of(), 400);
    financeCall(token, "POST", "/api/v1/supplier/orders/" + order + "/confirm", Map.of(), 200);
    assertThat(jdbc.queryForObject("select status from purchase_orders where id=?", String.class, order)).isEqualTo("待发货");
    assertThat(jdbc.queryForObject("select status from purchase_orders where id=?", String.class, "o-" + other)).isEqualTo("待供应商确认");
    financeCall(token, "POST", "/api/v1/supplier/orders/" + order + "/invoices", Map.of(), 403);
    jdbc.update("update roles set permissions='[]'::jsonb where id=?", operatorRole);
    http.perform(get("/api/v1/supplier/orders").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
  }

  @Test
  void portalPermissionsIgnoreAccidentallyAssignedRolesFromOtherScope() throws Exception {
    String operator = "mixed-" + user;
    String operatorRole = "mixed-" + role;
    seedPortalAccount(operator, operatorRole, "platform", null, "[\"platform:announcement:read\"]");
    String foreignRole = "foreign-" + role;
    jdbc.update("insert into roles(id,scope,name,permissions) values (?,'supplier','Invalid assignment','[\"platform:*\"]'::jsonb)", foreignRole);
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)", operator, foreignRole);
    String token = portalLogin(operator, "PLATFORM", null);
    var response = http.perform(get("/api/v1/auth/permissions").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk()).andReturn();
    assertThat(response.getResponse().getContentAsString()).contains("platform:announcement:read").doesNotContain("platform:*");
    http.perform(get("/api/v1/platform/tenants").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
  }

  @Test
  void supplierOnboardingAssignsExplicitRolesAndTeamMutationsStayIsolated() throws Exception {
    String operator = "platform-" + user;
    seedPortalAccount(operator, "platform-" + role, "platform", null, "[\"platform:supplier:manage\"]");
    String platformToken = portalLogin(operator, "PLATFORM", null);
    String supplier = "onboard-" + tenant;
    var created = financeCall(platformToken, "POST", "/api/v1/platform/suppliers", Map.of(
        "enterpriseId", supplier, "name", "Supplier onboarding", "industry", "IT",
        "adminName", "Owner", "adminEmail", supplier + "@example.com", "adminPassword", "Quality-Test-123!"), 201);
    String owner = created.path("adminUserId").asText();
    String ownerToken = portalLogin(owner, "SUPPLIER", supplier);
    assertThat(jdbc.queryForList("select role_id from user_roles where user_id=?", String.class, owner))
        .containsExactly("role-system-supplier-owner");
    // An alphabetically earlier administrator role must never become the member default.
    jdbc.update("insert into roles(id,scope,name,permissions) values (?,'supplier','Legacy admin','[\"supplier:*\"]'::jsonb)", "aaa-" + role);
    var member = financeCall(ownerToken, "POST", "/api/v1/supplier/users", Map.of(
        "name", "Member", "email", "member-" + supplier + "@example.com", "status", "active",
        "initialPassword", "Quality-Test-123!"), 201);
    String memberId = member.path("id").asText();
    assertThat(member.path("roleId").asText()).isEqualTo("role-system-supplier-member");
    String memberToken = portalLogin(memberId, "SUPPLIER", supplier);
    http.perform(get("/api/v1/supplier/orders").header("Authorization", "Bearer " + memberToken)).andExpect(status().isOk());
    http.perform(get("/api/v1/supplier/users").header("Authorization", "Bearer " + memberToken)).andExpect(status().isForbidden());
    financeCall(memberToken, "POST", "/api/v1/supplier/users/" + owner + "/password", Map.of("newPassword", "Changed-123!"), 403);
    financeCall(memberToken, "POST", "/api/v1/supplier/users", Map.of("name", "Escalation", "status", "active", "initialPassword", "Quality-Test-123!"), 403);
    financeCall(ownerToken, "POST", "/api/v1/supplier/users/" + owner + "/status", Map.of("status", "inactive"), 400);
    financeCall(ownerToken, "POST", "/api/v1/supplier/users/" + user + "/status", Map.of("status", "inactive"), 400);
    financeCall(ownerToken, "POST", "/api/v1/supplier/users/" + memberId + "/status", Map.of("status", "inactive"), 200);
    http.perform(get("/api/v1/supplier/orders").header("Authorization", "Bearer " + memberToken)).andExpect(status().isUnauthorized());
    financeCall(ownerToken, "POST", "/api/v1/supplier/users/" + memberId + "/status", Map.of("status", "active"), 200);
    http.perform(get("/api/v1/supplier/orders").header("Authorization", "Bearer " + memberToken)).andExpect(status().isUnauthorized());
    String freshToken = portalLogin(memberId, "SUPPLIER", supplier);
    financeCall(ownerToken, "POST", "/api/v1/supplier/users/" + memberId + "/password", Map.of("newPassword", "Changed-123!"), 200);
    http.perform(get("/api/v1/supplier/orders").header("Authorization", "Bearer " + freshToken)).andExpect(status().isUnauthorized());
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where target_id=?", Integer.class, memberId)).isEqualTo(4);
  }

  private void seedPortalAccount(String account, String assignedRole, String scope, String supplierId, String granted) {
    jdbc.update("insert into users(id,name,status,password_hash,supplier_id) values (?,'Restricted operator','active',?,?)",
        account, passwords.encode("Quality-Test-123!"), supplierId);
    jdbc.update("insert into roles(id,scope,name,permissions) values (?,?,'Restricted role',?::jsonb)", assignedRole, scope, granted);
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)", account, assignedRole);
  }

  private String portalLogin(String account, String scope, String supplierId) throws Exception {
    var body = new java.util.HashMap<String, Object>(Map.of("account", account, "password", "Quality-Test-123!", "scope", scope));
    if (supplierId != null) body.put("supplierId", supplierId);
    var response = http.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
        .andExpect(status().isOk()).andReturn();
    return json.readTree(response.getResponse().getContentAsString()).path("data").path("accessToken").asText();
  }

  private String login() throws Exception {
    return loginAs(user);
  }

  private String loginAs(String account) throws Exception {
    var result = http.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("account", account, "password", "Quality-Test-123!",
                "scope", "BUYER", "tenantId", tenant))))
        .andExpect(status().isOk()).andReturn();
    return json.readTree(result.getResponse().getContentAsString()).path("data").path("accessToken").asText();
  }

  private void listWith(String token, int expected) throws Exception {
    http.perform(get("/api/v1/buyer/demands").header("Authorization", "Bearer " + token))
        .andExpect(status().is(expected));
  }
}
