package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.buyer.api.ProjectContracts.*;
import com.procurement.buyer.application.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.process.api.*;
import com.procurement.process.application.ProcessDefinitionApplicationService;
import com.procurement.workflow.api.CompleteWorkflowTaskRequest;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@SpringBootTest
@Testcontainers
@org.springframework.test.annotation.DirtiesContext(
    classMode = org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class ProcurementProjectIT {
  @Container
  static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl);
    r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword);
    r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "");
  }

  @Autowired JdbcTemplate jdbc;
  @Autowired ProcurementProjectService projects;
  @Autowired ProjectAttachmentAccess attachments;
  @Autowired BudgetControlService budget;
  @Autowired PurchaseDemandApplicationService demands;
  @Autowired UnifiedWorkflowApplicationService workflow;
  @Autowired ProcessDefinitionApplicationService definitions;
  @Autowired Validator validator;
  String tenant, dept, author, reviewer, role, material;
  final String year = Year.now(ZoneId.of("Asia/Shanghai")).toString();

  @BeforeEach
  void seed() {
    String suffix = UUID.randomUUID().toString();
    tenant = "project-it-" + suffix;
    dept = "dept-" + suffix;
    author = "author-" + suffix;
    reviewer = "reviewer-" + suffix;
    role = "role-" + suffix;
    material = "material-" + suffix;
    jdbc.update(
        "insert into tenants(id,name,plan,status,enabled_features) values (?,'Project"
            + " IT','starter','active','[\"rfq\",\"order\",\"finance\",\"method:compare\",\"method:tender\"]'::jsonb)",
        tenant);
    jdbc.update(
        "insert into departments(id,tenant_id,name,status) values (?,?,'Procurement','active')",
        dept,
        tenant);
    for (String user : List.of(author, reviewer))
      jdbc.update(
          "insert into users(id,tenant_id,name,status,department_id) values (?,?,?,'active',?)",
          user,
          tenant,
          user,
          dept);
    jdbc.update(
        "insert into roles(id,tenant_id,scope,name,permissions,data_scope) values"
            + " (?,?,'buyer','Project admin','[\"buyer:*\"]'::jsonb,'all')",
        role,
        tenant);
    for (String user : List.of(author, reviewer))
      jdbc.update("insert into user_roles(user_id,role_id) values (?,?)", user, role);
    jdbc.update(
        "insert into materials(id,tenant_id,code,name,category,unit,reference_price,specification)"
            + " values (?,?,'IT-01','Computer','IT','台',999,'Original spec')",
        material,
        tenant);
    context(author);
    for (String type : List.of("project_initiation", "purchase_demand")) {
      var definition =
          definitions.createProcess(
              new CreateProcessDefinitionRequest("Project " + type, "", "file-text", type));
      String flow =
          "{\"steps\":[{\"id\":\"review\",\"type\":\"approver\",\"title\":\"Independent"
              + " review\",\"assignment\":{\"type\":\"role\",\"roleId\":\""
              + role
              + "\"}}]}";
      definitions.updateProcess(
          definition.id(),
          new UpdateProcessDefinitionRequest(
              definition.name(), "", "draft", "{\"fields\":[]}", flow, type));
      definitions.publishProcess(definition.id());
    }
  }

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  void context(String user) {
    TenantContext.set(tenant, null, user);
  }

  Draft draft(int revision) {
    return new Draft(
        "Office renewal",
        dept,
        author,
        year,
        "Annual funds",
        "Replace obsolete equipment",
        List.of(new LineInput(material, new BigDecimal("2"), new BigDecimal("123.4567"), "Office")),
        revision);
  }

  Action action(Detail d) {
    return new Action(d.project().revision(), "Verified business basis", Map.of());
  }

  Detail approve(Detail d) {
    var submitted = projects.submit(d.project().id(), action(d));
    assertThat(
            workflow.listCurrentUserTasks().stream()
                .filter(t -> t.businessId().equals(d.project().id())))
        .isEmpty();
    decide(d.project().id(), "approve");
    return projects.detail(submitted.project().id());
  }

  void decide(String id, String action) {
    context(reviewer);
    var task =
        workflow.listCurrentUserTasks().stream()
            .filter(t -> t.businessId().equals(id))
            .findFirst()
            .orElseThrow();
    workflow.completeCurrentUserTask(
        task.taskId(), new CompleteWorkflowTaskRequest(action, "Independent assessment"));
    context(author);
  }

  @Test
  void draftAmountsSnapshotsValidationAndRevisionAreReal() {
    var d = projects.create(draft(0));
    assertThat(d.project().plannedAmount()).isEqualByComparingTo("246.91");
    assertThat(d.lines().getFirst().specification()).isEqualTo("Original spec");
    assertThat(validator.validate(action(d))).isEmpty();
    assertThat(projects.options().departments()).extracting(Option::id).containsExactly(dept);
    assertThat(projects.list(1, 10, "draft", "Office").total()).isEqualTo(1);
    jdbc.update("update materials set specification='New spec' where id=?", material);
    assertThat(projects.detail(d.project().id()).lines().getFirst().specification())
        .isEqualTo("Original spec");
    projects.edit(d.project().id(), draft(d.project().revision()));
    assertThatThrownBy(() -> projects.edit(d.project().id(), draft(0)))
        .hasMessageContaining("已被修改");
    var invalid =
        new Draft(
            "Invalid",
            dept,
            author,
            year,
            "Funds",
            "Purpose",
            List.of(new LineInput("foreign-material", BigDecimal.ONE, BigDecimal.ONE, "")),
            0);
    assertThatThrownBy(() -> projects.create(invalid)).hasMessageContaining("物料不属于");
    assertThat(projects.list(1, 10, "", "").total()).isEqualTo(1);
  }

  @Test
  void initiationDoesNotReserveBudgetAndDemandApprovalPrecedesProcurement() {
    var d = approve(projects.create(draft(0)));
    assertThat(d.project().status()).isEqualTo("approved");
    assertThat(budget.position(tenant, dept, year).pending()).isEqualByComparingTo("0");
    assertThatThrownBy(() -> projects.edit(d.project().id(), draft(d.project().revision())))
        .hasMessageContaining("只能编辑");
    assertThatThrownBy(() -> attachments.requireAccess(d.project().id(), true))
        .hasMessageContaining("仅草稿");
    var linked = projects.createDemand(d.project().id(), action(d));
    var demand = projects.demands(d.project().id()).getFirst();
    assertThat(demand.budget()).isEqualByComparingTo("246.91");
    assertThatThrownBy(
            () ->
                projects.createExecution(
                    d.project().id(), new ExecutionRequest(linked.project().revision(), "rfq")))
        .hasMessageContaining("先完成");
    demands.submit(demand.id(), Map.of());
    decide(demand.id(), "approve");
    assertThat(budget.position(tenant, dept, year).committed()).isEqualByComparingTo("246.91");
    var execution =
        projects.createExecution(
            d.project().id(), new ExecutionRequest(linked.project().revision(), "rfq"));
    assertThat(execution.project().executionType()).isEqualTo("rfq");
    assertThat(projects.execution(d.project().id()).canClose()).isFalse();
    assertThat(budget.position(tenant, dept, year).committed()).isEqualByComparingTo("246.91");
    assertThatThrownBy(
            () ->
                projects.createExecution(
                    d.project().id(), new ExecutionRequest(execution.project().revision(), "rfq")))
        .hasMessageContaining("已有采购执行");
    assertThatThrownBy(() -> projects.close(d.project().id(), action(execution)))
        .hasMessageContaining("尚不能结项");
  }

  @Test
  void withdrawalRejectionAndResubmissionRetainSeparateWorkflowHistory() {
    var d = projects.create(draft(0));
    var first = projects.submit(d.project().id(), action(d));
    var withdrawn = projects.withdraw(d.project().id(), action(first));
    assertThat(withdrawn.project().status()).isEqualTo("withdrawn");
    assertThat(workflow.getCurrentTenantHistory(first.project().workflowInstanceId()).status())
        .isEqualTo("cancelled");
    var second = projects.submit(d.project().id(), action(withdrawn));
    decide(d.project().id(), "reject");
    var rejected = projects.detail(d.project().id());
    assertThat(rejected.project().status()).isEqualTo("rejected");
    var approved = approve(rejected);
    assertThat(approved.project().workflowInstanceId())
        .isNotEqualTo(second.project().workflowInstanceId());
    assertThat(workflow.getCurrentTenantHistory(second.project().workflowInstanceId()).status())
        .isEqualTo("rejected");
  }

  @Test
  void permissionsTenantAndCreatorScopeAreEnforcedBeforeCountsAndOptions() {
    var d = projects.create(draft(0));
    jdbc.update(
        "update roles set permissions='[\"buyer:project:read\"]'::jsonb,data_scope='self' where"
            + " id=?",
        role);
    context(reviewer);
    assertThat(projects.list(1, 10, "", "").total()).isZero();
    assertThatThrownBy(() -> projects.detail(d.project().id()))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    assertThatThrownBy(() -> projects.create(draft(0)))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    assertThatThrownBy(projects::options)
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    TenantContext.set("other-tenant", null, author);
    assertThatThrownBy(() -> projects.detail(d.project().id()))
        .isInstanceOf(RuntimeException.class);
  }
}
