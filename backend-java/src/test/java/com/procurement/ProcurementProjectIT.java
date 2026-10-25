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
  @Autowired com.procurement.sourcing.application.RfqApplicationService rfqs;
  @Autowired ProjectExpansionService expansion;
  @Autowired ProcurementProjectGuard projectGuard;
  @Autowired ProjectAllocationPolicy allocation;
  @Autowired ProjectCloseoutService closeout;
  @Autowired ProjectChangeAttachmentAccess changeAttachments;
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
    for (String type : List.of("project_initiation", "purchase_demand", "project_change")) {
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
  void legacyAndProjectEntryCompeteWithoutDeadlockOrDuplicateExecution() throws Exception {
    var d = approve(projects.create(draft(0)));
    var linked = projects.createDemand(d.project().id(), action(d));
    var demand = projects.demands(d.project().id()).getFirst();
    demands.submit(demand.id(), Map.of());
    decide(demand.id(), "approve");
    var start = new java.util.concurrent.CountDownLatch(1);
    try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
      var tasks = new ArrayList<java.util.concurrent.Future<Boolean>>();
      for (boolean fromProject : List.of(true, false)) {
        tasks.add(
            pool.submit(
                () -> {
                  context(author);
                  try {
                    start.await();
                    if (fromProject)
                      projects.createExecution(
                          d.project().id(),
                          new ExecutionRequest(linked.project().revision(), "rfq"));
                    else rfqs.createProjectDraft("Competing legacy entry", List.of(demand.id()));
                    return true;
                  } catch (RuntimeException e) {
                    assertThat(
                            org.springframework.core.NestedExceptionUtils.getMostSpecificCause(e)
                                .getMessage()
                                .toLowerCase(Locale.ROOT))
                        .doesNotContain("deadlock");
                    return false;
                  } finally {
                    TenantContext.clear();
                  }
                }));
      }
      start.countDown();
      int winners = 0;
      for (var task : tasks) if (task.get(15, java.util.concurrent.TimeUnit.SECONDS)) winners++;
      assertThat(winners).isEqualTo(1);
    }
    assertThat(
            jdbc.queryForObject(
                "select count(*) from rfqs where tenant_id=?", Integer.class, tenant))
        .isEqualTo(1);
    assertThat(projects.detail(d.project().id()).project().executionId()).isNotBlank();
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

  com.procurement.buyer.api.ProjectExpansionContracts.PackageDetail lot(
      String project, String qty) {
    return expansion.savePackage(
        project,
        null,
        new com.procurement.buyer.api.ProjectExpansionContracts.PackageDraft(
            projects.detail(project).project().revision(),
            0,
            "Package " + UUID.randomUUID(),
            List.of(
                new com.procurement.buyer.api.ProjectExpansionContracts.Allocation(
                    material, new BigDecimal(qty))),
            List.of()));
  }

  com.procurement.buyer.api.ProjectExpansionContracts.PackageDetail ready(
      com.procurement.buyer.api.ProjectExpansionContracts.PackageDetail lot) {
    var d =
        expansion.createDemand(
            lot.info().projectId(),
            lot.info().id(),
            new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
                lot.info().revision(), "Generate scoped demand"));
    demands.submit(d.demands().getFirst().id(), Map.of());
    decide(d.demands().getFirst().id(), "approve");
    return expansion.packages(lot.info().projectId()).stream()
        .filter(l -> l.info().id().equals(lot.info().id()))
        .findFirst()
        .orElseThrow();
  }

  @Test
  void packagesSplitDecimalBudgetWithTailRoundingAndCannotOverallocate() {
    var p = approve(projects.create(draft(0))).project();
    var a = lot(p.id(), "1");
    var b = lot(p.id(), "1");
    assertThat(a.info().amount()).isEqualByComparingTo("123.46");
    assertThat(b.info().amount()).isEqualByComparingTo("123.45");
    assertThat(a.info().projectRevision()).isEqualTo(1);
    assertThat(b.info().projectRevision()).isEqualTo(1);
    assertThatThrownBy(() -> lot(p.id(), "1")).hasMessageContaining("数量超过");
    assertThatThrownBy(() -> projects.createDemand(p.id(), action(projects.detail(p.id()))))
        .hasMessageContaining("分包");
    expansion.cancel(
        p.id(),
        b.info().id(),
        new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
            b.info().revision(), "Cancelled before procurement"));
    assertThat(lot(p.id(), "1").info().amount()).isEqualByComparingTo("123.45");
  }

  @Test
  void eachPackageHasIndependentDemandsAndOneActiveExecutionWithoutBudgetDuplication() {
    var p = approve(projects.create(draft(0))).project();
    var a = ready(lot(p.id(), "1"));
    var b = ready(lot(p.id(), "1"));
    var ea =
        expansion.execute(
            p.id(),
            a.info().id(),
            new com.procurement.buyer.api.ProjectExpansionContracts.PackageExecution(
                a.info().revision(), "rfq", "First"),
            false);
    var eb =
        expansion.execute(
            p.id(),
            b.info().id(),
            new com.procurement.buyer.api.ProjectExpansionContracts.PackageExecution(
                b.info().revision(), "rfq", "Second"),
            false);
    assertThat(ea.runs().getFirst().executionId()).isNotEqualTo(eb.runs().getFirst().executionId());
    assertThat(projects.detail(p.id()).project().executionId()).isNull();
    assertThat(
            projects.execution(p.id()).documents().stream()
                .filter(d -> d.module().equals("demands")))
        .hasSize(2);
    assertThat(budget.position(tenant, dept, year).committed()).isEqualByComparingTo("246.91");
    assertThatThrownBy(
            () ->
                expansion.execute(
                    p.id(),
                    ea.info().id(),
                    new com.procurement.buyer.api.ProjectExpansionContracts.PackageExecution(
                        ea.info().revision(), "rfq", "duplicate"),
                    false))
        .hasMessageContaining("已有有效执行");
  }

  @Test
  void approvedChangeOnlyAppliesAfterIndependentApprovalAndKeepsExistingPackageSnapshots() {
    var p = approve(projects.create(draft(0))).project();
    var a = lot(p.id(), "1");
    p = projects.detail(p.id()).project();
    String project = p.id();
    var proposal =
        new Draft(
            "Expanded plan",
            dept,
            author,
            year,
            "Additional funds",
            "Add equipment",
            List.of(
                new LineInput(material, new BigDecimal("3"), new BigDecimal("123.4567"), "Office")),
            p.revision());
    var c =
        expansion.saveChange(
            project,
            null,
            new com.procurement.buyer.api.ProjectExpansionContracts.ChangeDraft(
                p.revision(), 0, "Additional approved scope", proposal));
    assertThat(projects.detail(project).project().plannedAmount()).isEqualByComparingTo("246.91");
    var pending =
        expansion.submitChange(
            project, c.id(), new Action(c.revision(), "Submit change", Map.of()));
    assertThatThrownBy(() -> lot(project, "1")).hasMessageContaining("变更审批中");
    decide(c.id(), "approve");
    assertThat(projects.detail(project).project().plannedAmount()).isEqualByComparingTo("370.37");
    assertThat(expansion.packages(project).getFirst().info().snapshot())
        .isEqualTo(a.info().snapshot());
    var b = lot(project, "1");
    assertThat(b.info().projectRevision()).isEqualTo(2);
    assertThat(allocation.tree(b.info().snapshot()).path("changeIds").toString()).contains(c.id());
    assertThatThrownBy(
            () ->
                expansion.withdrawChange(
                    project, c.id(), new Action(pending.revision() + 1, "Too late", Map.of())))
        .hasMessageContaining("已结束");
  }

  @Test
  void changeCannotReduceAllocatedQuantityOrBudgetAndRejectedAndWithdrawnFormsDoNotApply() {
    var p = approve(projects.create(draft(0))).project();
    lot(p.id(), "2");
    String project = p.id();
    p = projects.detail(project).project();
    var smaller =
        new Draft(
            "Invalid",
            dept,
            author,
            year,
            "Funds",
            "Reduce",
            List.of(new LineInput(material, BigDecimal.ONE, BigDecimal.ONE, "")),
            p.revision());
    int version = p.revision();
    assertThatThrownBy(
            () ->
                expansion.saveChange(
                    project,
                    null,
                    new com.procurement.buyer.api.ProjectExpansionContracts.ChangeDraft(
                        version, 0, "Invalid decrease", smaller)))
        .hasMessageContaining("减少");
    var valid =
        new Draft(
            "Changed title",
            dept,
            author,
            year,
            "Funds",
            "Unchanged scope",
            draft(0).lines(),
            version);
    var c =
        expansion.saveChange(
            project,
            null,
            new com.procurement.buyer.api.ProjectExpansionContracts.ChangeDraft(
                version, 0, "Clarify title", valid));
    var pending =
        expansion.submitChange(project, c.id(), new Action(c.revision(), "Submit", Map.of()));
    decide(c.id(), "reject");
    assertThat(projects.detail(project).project().title()).isEqualTo("Office renewal");
    var rejected = expansion.change(project, c.id(), false);
    var again =
        expansion.submitChange(
            project, c.id(), new Action(rejected.revision(), "Resubmit", Map.of()));
    assertThat(again.workflowInstanceId()).isNotEqualTo(pending.workflowInstanceId());
    expansion.withdrawChange(project, c.id(), new Action(again.revision(), "Withdraw", Map.of()));
    assertThat(projects.detail(project).project().revision()).isEqualTo(version);
  }

  @Test
  void approvedChangePreservesLegacyExecutionSnapshotAndAllowsAdditionalPackages() {
    var d = approve(projects.create(draft(0)));
    d = projects.createDemand(d.project().id(), action(d));
    var demand = projects.demands(d.project().id()).getFirst();
    demands.submit(demand.id(), Map.of());
    decide(demand.id(), "approve");
    d =
        projects.createExecution(
            d.project().id(), new ExecutionRequest(d.project().revision(), "rfq"));
    String project = d.project().id(), rfq = d.project().executionId();
    String before =
        com.procurement.sourcing.application.ProcurementExecutionArchiveWriter.hash(
            projectGuard.archiveDefinitionForRfq(rfq));
    var proposal =
        new Draft(
            "Legacy plus new scope",
            dept,
            author,
            year,
            "Funds",
            "More equipment",
            List.of(
                new LineInput(material, new BigDecimal("3"), new BigDecimal("123.4567"), "Office")),
            d.project().revision());
    var change =
        expansion.saveChange(
            project,
            null,
            new com.procurement.buyer.api.ProjectExpansionContracts.ChangeDraft(
                d.project().revision(), 0, "Extend scope", proposal));
    expansion.submitChange(project, change.id(), new Action(change.revision(), "Submit", Map.of()));
    decide(change.id(), "approve");
    assertThat(
            com.procurement.sourcing.application.ProcurementExecutionArchiveWriter.hash(
                projectGuard.archiveDefinitionForRfq(rfq)))
        .isEqualTo(before);
    assertThat(lot(project, "1").info().amount()).isEqualByComparingTo("123.46");
  }

  @Test
  void reworkReleasesExposureRetainsApprovalAndRequiresFreshApproval() {
    var p = approve(projects.create(draft(0))).project();
    var l = ready(lot(p.id(), "1"));
    assertThat(budget.position(tenant, dept, year).committed()).isEqualByComparingTo("123.46");
    closeout.adjust(
        p.id(),
        l.info().id(),
        new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
            l.info().revision(), "Revise procurement plan"),
        true);
    assertThat(projects.demands(p.id()).getFirst().status()).isEqualTo("草稿");
    assertThat(budget.position(tenant, dept, year).occupied()).isEqualByComparingTo("0");
    var h = closeout.history(p.id(), 1, 10);
    assertThat(h.items().getFirst().snapshot()).contains("已通过");
    assertThat(h.items().getFirst().releasedAmount()).isEqualByComparingTo("123.46");
    assertThat(
            jdbc.queryForObject(
                "select status from workflow_business_instances where tenant_id=? and"
                    + " business_type='purchase_demand'",
                String.class,
                tenant))
        .isEqualTo("approved");
    String demand = l.demands().getFirst().id();
    demands.submit(demand, Map.of());
    decide(demand, "approve");
    var fresh = expansion.packages(p.id()).getFirst();
    expansion.execute(
        p.id(),
        fresh.info().id(),
        new com.procurement.buyer.api.ProjectExpansionContracts.PackageExecution(
            fresh.info().revision(), "rfq", "Fresh approval obtained"),
        false);
    assertThat(budget.position(tenant, dept, year).committed()).isEqualByComparingTo("123.46");
    assertThatThrownBy(
            () ->
                closeout.adjust(
                    p.id(),
                    fresh.info().id(),
                    new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
                        fresh.info().revision(), "Stale click"),
                    false))
        .hasMessageContaining("变化");
  }

  @Test
  void pendingDemandReworkUsesRealInitiatorWithdrawalAndRollsBackForOthers() {
    var p = approve(projects.create(draft(0))).project();
    var l = lot(p.id(), "1");
    l =
        expansion.createDemand(
            p.id(),
            l.info().id(),
            new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
                l.info().revision(), "Generate"));
    String lotId = l.info().id();
    int revision = l.info().revision();
    String demand = l.demands().getFirst().id();
    demands.submit(demand, Map.of());
    context(reviewer);
    assertThatThrownBy(
            () ->
                closeout.adjust(
                    p.id(),
                    lotId,
                    new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
                        revision, "Wrong initiator"),
                    true))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    assertThat(closeout.history(p.id(), 1, 10).total()).isZero();
    assertThat(projects.demands(p.id()).getFirst().status()).isEqualTo("审批中");
    context(author);
    closeout.adjust(
        p.id(),
        lotId,
        new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
            revision, "Withdraw and recompile"),
        true);
    assertThat(
            jdbc.queryForObject(
                "select status from workflow_business_instances where tenant_id=? and"
                    + " business_type='purchase_demand'",
                String.class,
                tenant))
        .isEqualTo("cancelled");
    assertThat(projects.demands(p.id()).getFirst().status()).isEqualTo("草稿");
    assertThat(budget.position(tenant, dept, year).occupied()).isEqualByComparingTo("0");
  }

  @Test
  void approvedUnpurchasedPackageCanStopAndReleaseAllocationWithoutDeletingHistory() {
    var p = approve(projects.create(draft(0))).project();
    var l = ready(lot(p.id(), "1"));
    closeout.adjust(
        p.id(),
        l.info().id(),
        new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
            l.info().revision(), "Procurement no longer needed"),
        false);
    assertThat(expansion.packages(p.id()).getFirst().info().status()).isEqualTo("cancelled");
    assertThat(projects.demands(p.id()).getFirst().status()).isEqualTo("已取消");
    assertThat(closeout.monitor(p.id()).packages().getFirst().milestones())
        .allMatch(m -> !m.complete() && !m.overdue());
    assertThat(expansion.summary(p.id()).demandAmount()).isEqualByComparingTo("0");
    assertThat(lot(p.id(), "2").info().amount()).isEqualByComparingTo("246.91");
    assertThatThrownBy(() -> demands.submit(l.demands().getFirst().id(), Map.of()))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void concurrentApprovalAndReworkPreserveStateWithoutDeadlock() throws Exception {
    var p=approve(projects.create(draft(0))).project();var l=lot(p.id(),"1");
    var linked=expansion.createDemand(p.id(),l.info().id(),new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(l.info().revision(),"Generate concurrent demand"));
    String demand=linked.demands().getFirst().id();demands.submit(demand,Map.of());context(reviewer);
    String task=workflow.listCurrentUserTasks().stream().filter(t->t.businessId().equals(demand)).findFirst().orElseThrow().taskId();context(author);
    var barrier=new java.util.concurrent.CountDownLatch(1);
    try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)){
      var edit=pool.submit(()->{context(author);try{barrier.await();closeout.adjust(p.id(),linked.info().id(),new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(linked.info().revision(),"Concurrent rework"),true);return true;}catch(RuntimeException e){assertThat(e).isNotInstanceOf(org.springframework.dao.DataAccessException.class);assertThat(e.getMessage()).doesNotContainIgnoringCase("deadlock");return false;}finally{TenantContext.clear();}});
      var approval=pool.submit(()->{context(reviewer);try{barrier.await();workflow.completeCurrentUserTask(task,new CompleteWorkflowTaskRequest("approve","Concurrent review"));return true;}catch(RuntimeException e){assertThat(e).isNotInstanceOf(org.springframework.dao.DataAccessException.class);assertThat(e.getMessage()).doesNotContainIgnoringCase("deadlock");return false;}finally{TenantContext.clear();}});
      barrier.countDown();boolean edited=edit.get(15,java.util.concurrent.TimeUnit.SECONDS),approved=approval.get(15,java.util.concurrent.TimeUnit.SECONDS);assertThat(edited||approved).isTrue();
      String state=projects.demands(p.id()).getFirst().status();assertThat(state).isIn("草稿","已通过");if(edited)assertThat(state).isEqualTo("草稿");assertThat(budget.position(tenant,dept,year).occupied()).isEqualByComparingTo("草稿".equals(state)?BigDecimal.ZERO:linked.info().amount());
    }
  }

  @Test
  void planHasActualEvidenceOverdueDetectionPaginationAndOptimisticVersions() {
    var p = approve(projects.create(draft(0))).project();
    var l = lot(p.id(), "1");
    for (int n = 0; n < 12; n++) {
      var row = expansion.packages(p.id()).getFirst();
      closeout.plan(
          p.id(),
          row.info().id(),
          new com.procurement.buyer.api.ProjectCloseoutContracts.Plan(
              row.info().revision(),
              "demand",
              LocalDate.now(ZoneId.of("Asia/Shanghai")).minusDays(1),
              "Plan revision " + n));
    }
    assertThat(closeout.history(p.id(), 2, 10).items()).hasSize(2);
    assertThat(closeout.history(p.id(), 1, 10).total()).isEqualTo(12);
    assertThat(closeout.monitor(p.id()).overdueCount()).isEqualTo(1);
    assertThatThrownBy(
            () ->
                closeout.plan(
                    p.id(),
                    l.info().id(),
                    new com.procurement.buyer.api.ProjectCloseoutContracts.Plan(
                        l.info().revision(), "close", LocalDate.now(), "Stale")))
        .hasMessageContaining("变化");
    var current = expansion.packages(p.id()).getFirst();
    assertThatThrownBy(
            () ->
                closeout.plan(
                    p.id(),
                    current.info().id(),
                    new com.procurement.buyer.api.ProjectCloseoutContracts.Plan(
                        current.info().revision(),
                        "order",
                        LocalDate.now(ZoneId.of("Asia/Shanghai")).minusDays(2),
                        "Invalid sequence")))
        .hasMessageContaining("先后顺序");
    ready(expansion.packages(p.id()).getFirst());
    assertThat(closeout.monitor(p.id()).overdueCount()).isZero();
    assertThat(closeout.monitor(p.id()).packages().getFirst().milestones().getFirst().complete())
        .isTrue();
  }

  @Test
  void projectTerminationCancelsOnlyUnpurchasedScopeAndHasDownloadableAuditArchive()
      throws Exception {
    var p = approve(projects.create(draft(0))).project();
    ready(lot(p.id(), "1"));
    lot(p.id(), "1");
    assertThatThrownBy(() -> closeout.download(p.id())).hasMessageContaining("仅已结项");
    var fresh = projects.detail(p.id());
    var change =
        expansion.saveChange(
            p.id(),
            null,
            new com.procurement.buyer.api.ProjectExpansionContracts.ChangeDraft(
                fresh.project().revision(),
                0,
                "Unsubmitted change",
                draft(fresh.project().revision())));
    assertThatThrownBy(() -> projects.terminate(p.id(), action(fresh))).hasMessageContaining("先处理");
    expansion.withdrawChange(
        p.id(), change.id(), new Action(change.revision(), "Withdraw draft", Map.of()));
    projects.terminate(p.id(), action(fresh));
    assertThat(projects.detail(p.id()).project().status()).isEqualTo("terminated");
    assertThatThrownBy(() -> changeAttachments.requireAccess(change.id(), true))
        .hasMessageContaining("项目已结束");
    assertThat(budget.position(tenant, dept, year).occupied()).isEqualByComparingTo("0");
    assertThat(expansion.packages(p.id())).allMatch(l -> "cancelled".equals(l.info().status()));
    var names = new ArrayList<String>();
    try (var zip =
        new java.util.zip.ZipInputStream(
            new java.io.ByteArrayInputStream(closeout.download(p.id())),
            java.nio.charset.StandardCharsets.UTF_8)) {
      java.util.zip.ZipEntry entry;
      while ((entry = zip.getNextEntry()) != null) names.add(entry.getName());
    }
    assertThat(names).contains("项目.json", "调整历史.json", "审批历史.json", "SHA256SUMS.txt");
    assertThatThrownBy(() -> projects.terminate(p.id(), action(projects.detail(p.id()))))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void projectDemandSubmissionCannotExceedPackageOrChangeDepartmentAfterRework() {
    var p = approve(projects.create(draft(0))).project();
    var l = ready(lot(p.id(), "1"));
    closeout.adjust(
        p.id(),
        l.info().id(),
        new com.procurement.buyer.api.ProjectExpansionContracts.PackageAction(
            l.info().revision(), "Rework"),
        true);
    String id = l.demands().getFirst().id();
    jdbc.update("update purchase_demands set budget=500 where tenant_id=? and id=?", tenant, id);
    assertThatThrownBy(() -> demands.submit(id, Map.of())).hasMessageContaining("超过分包");
    assertThat(projects.demands(p.id()).getFirst().status()).isEqualTo("草稿");
    jdbc.update("update roles set permissions='[\"buyer:project:read\"]'::jsonb where id=?", role);
    assertThatThrownBy(() -> closeout.monitor(p.id()))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
  }

  @Test
  void existingUnexecutedProjectDemandCanBeAdoptedByPackageWithoutRecreation() {
    var d = approve(projects.create(draft(0)));
    d = projects.createDemand(d.project().id(), action(d));
    var source = projects.demands(d.project().id()).getFirst();
    var adopted =
        expansion.savePackage(
            d.project().id(),
            null,
            new com.procurement.buyer.api.ProjectExpansionContracts.PackageDraft(
                d.project().revision(),
                0,
                "Adopt historical demand",
                List.of(
                    new com.procurement.buyer.api.ProjectExpansionContracts.Allocation(
                        material, new BigDecimal("2"))),
                List.of(source.id())));
    assertThat(adopted.demands()).extracting(Demand::id).containsExactly(source.id());
    assertThat(projects.demands(d.project().id())).hasSize(1);
  }
}
