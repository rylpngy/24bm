package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.demand.domain.PurchaseDemandStatus;
import com.procurement.process.api.CreateProcessDefinitionRequest;
import com.procurement.process.api.ProcessDefinitionResponse;
import com.procurement.process.api.UpdateProcessDefinitionRequest;
import com.procurement.process.application.ProcessDefinitionApplicationService;
import com.procurement.workflow.api.CompleteWorkflowTaskRequest;
import com.procurement.workflow.api.UnifiedWorkflowTaskResponse;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.flowable.engine.RepositoryService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// 真实基础设施验收：不 mock Flowable、MyBatis 或业务回调，验证采购需求已完全走统一运行时。
@SpringBootTest
@Testcontainers
@org.springframework.test.annotation.DirtiesContext(classMode = org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class UnifiedWorkflowRuntimeIT {
  private static final String TENANT_ID = "tenant-workflow-it";
  private static final String DEPARTMENT_ID = "dept-workflow-it";
  private static final String OTHER_DEPARTMENT_ID = "dept-workflow-other-it";
  private static final String REQUESTER_ID = "user-workflow-requester-it";
  private static final String REVIEWER_ID = "user-workflow-reviewer-it";
  private static final String OUTSIDER_ID = "user-workflow-outsider-it";
  private static final String REVIEWER_ROLE_ID = "role-workflow-reviewer-it";
  private static final String REQUESTER_ROLE_ID = "role-workflow-requester-it";
  private static final String DEMAND_ID = "demand-workflow-it";

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
      .withDatabaseName("procurement_saas_workflow_it")
      .withUsername("procurement")
      .withPassword("procurement");

  @DynamicPropertySource
  static void registerProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("keycloak.enabled", () -> false);
    registry.add("app.seed.locations", () -> "");
  }

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @Autowired
  private RepositoryService repositoryService;

  @Autowired private org.flowable.engine.RuntimeService runtimeService;
  @Autowired private org.flowable.engine.HistoryService historyService;

  @Autowired
  private ProcessDefinitionApplicationService processDefinitionApplicationService;

  @Autowired
  private PurchaseDemandApplicationService purchaseDemandApplicationService;

  @Autowired
  private UnifiedWorkflowApplicationService unifiedWorkflowApplicationService;

  @BeforeEach
  void setUpTenantData() {
    jdbcTemplate.update("""
        insert into tenants (id, name, plan, status)
        values (?, ?, ?, ?)
        on conflict (id) do nothing
        """, TENANT_ID, "统一工作流集成测试企业", "starter", "active");
    jdbcTemplate.update("""
        insert into departments (id, tenant_id, name, parent_id, status)
        values (?, ?, ?, null, 'active'), (?, ?, ?, null, 'active')
        on conflict (id) do nothing
        """, DEPARTMENT_ID, TENANT_ID, "采购部门", OTHER_DEPARTMENT_ID, TENANT_ID, "外部部门");
    insertUser(REQUESTER_ID, "需求申请人", DEPARTMENT_ID);
    insertUser(REVIEWER_ID, "流程审批人", DEPARTMENT_ID);
    insertUser(OUTSIDER_ID, "跨部门审批人", OTHER_DEPARTMENT_ID);
    jdbcTemplate.update("""
        update departments set manager_id = ?
        where tenant_id = ? and id = ?
        """, REVIEWER_ID, TENANT_ID, DEPARTMENT_ID);
    jdbcTemplate.update("""
        insert into roles (id, tenant_id, scope, name, permissions, data_scope)
        values (?, ?, 'buyer', ?, ?::jsonb, 'self'), (?, ?, 'buyer', ?, ?::jsonb, 'department')
        on conflict (id) do nothing
        """,
        REQUESTER_ROLE_ID, TENANT_ID, "需求申请", "[\"buyer:*\"]",
        REVIEWER_ROLE_ID, TENANT_ID, "流程审批", "[\"buyer:*\"]");
    assignRole(REQUESTER_ID, REQUESTER_ROLE_ID);
    assignRole(REVIEWER_ID, REVIEWER_ROLE_ID);
    assignRole(OUTSIDER_ID, REVIEWER_ROLE_ID);
    jdbcTemplate.update("""
        insert into purchase_demands (id, tenant_id, title, department_id, requester_id, budget, status)
        values (?, ?, ?, ?, ?, ?, ?)
        on conflict (id) do nothing
        """,
        DEMAND_ID,
        TENANT_ID,
        "统一工作流采购需求",
        DEPARTMENT_ID,
        REQUESTER_ID,
        new BigDecimal("120000"),
        PurchaseDemandStatus.DRAFT);
  }

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void purchaseDemandUsesPublishedFlowableVersionWithRoleDataScopeAndBusinessCallback() {
    TenantContext.set(TENANT_ID, null, REVIEWER_ID);
    ProcessDefinitionResponse created = demandProcess();
    processDefinitionApplicationService.updateProcess(
        created.id(),
        new UpdateProcessDefinitionRequest(
            "采购需求审批",
            "金额条件、候选角色和部门主管均由受控配置生成。",
            "draft",
            formSchema(),
            flowSchema(),
            ApprovalBusinessType.PURCHASE_DEMAND));
    ProcessDefinitionResponse published = processDefinitionApplicationService.publishProcess(created.id());

    assertThat(published.status()).isEqualTo("enabled");
    assertThat(published.activeVersionId()).isNotBlank();
    assertThat(repositoryService.createProcessDefinitionQuery()
        .processDefinitionKey("businessApproval")
        .count()).isZero();

    TenantContext.set(TENANT_ID, null, REQUESTER_ID);
    var submitted = purchaseDemandApplicationService.submit(
        DEMAND_ID,
        Map.of("reason", "生产设备更新", "urgency", "高"));
    assertThat(submitted.status()).isEqualTo("审批中");
    assertThat(jdbcTemplate.queryForObject(
        "select status from purchase_demands where id = ?", String.class, DEMAND_ID))
        .isEqualTo(PurchaseDemandStatus.IN_APPROVAL);

    // 即使属于候选角色，外部部门用户也不能越过工作流实例的数据范围。
    TenantContext.set(TENANT_ID, null, OUTSIDER_ID);
    assertThat(unifiedWorkflowApplicationService.listCurrentUserTasks()).isEmpty();
    assertThatThrownBy(() -> unifiedWorkflowApplicationService.completeCurrentUserTask(
        submitted.id(), new CompleteWorkflowTaskRequest("approve", "越权办理")))
        .isInstanceOf(PermissionDeniedException.class);

    TenantContext.set(TENANT_ID, null, REVIEWER_ID);
    List<UnifiedWorkflowTaskResponse> tasks = unifiedWorkflowApplicationService.listCurrentUserTasks();
    assertThat(tasks).singleElement().satisfies(task -> {
      assertThat(task.businessType()).isEqualTo(ApprovalBusinessType.PURCHASE_DEMAND);
      assertThat(task.businessId()).isEqualTo(DEMAND_ID);
      assertThat(task.candidateRoleIds()).containsExactly(REVIEWER_ROLE_ID);
      assertThat(task.departmentId()).isEqualTo(DEPARTMENT_ID);
      assertThat(task.amount()).isEqualByComparingTo("120000");
    });

    var history = unifiedWorkflowApplicationService.completeCurrentUserTask(
        tasks.getFirst().taskId(), new CompleteWorkflowTaskRequest("approve", "金额和业务说明已核验"));

    assertThat(history.status()).isEqualTo("approved");
    assertThat(history.formSchema()).contains("申请说明");
    processDefinitionApplicationService.updateProcess(created.id(), new UpdateProcessDefinitionRequest(
        "新版采购需求审批", "修改字段标签", "draft",
        formSchema().replace("申请说明", "新版申请说明"), flowSchema(), ApprovalBusinessType.PURCHASE_DEMAND));
    processDefinitionApplicationService.publishProcess(created.id());
    var historical = unifiedWorkflowApplicationService.getCurrentTenantHistory(history.workflowInstanceId());
    assertThat(historical.definitionVersionId()).isEqualTo(published.activeVersionId());
    assertThat(historical.formSchema()).isEqualTo(history.formSchema()).doesNotContain("新版申请说明");
    assertThat(history.events()).extracting(event -> event.action())
        .contains("created", "claimed", "approved");
    assertThat(history.events()).filteredOn(event -> "approved".equals(event.action()))
        .singleElement()
        .satisfies(event -> {
          assertThat(event.actorId()).isEqualTo(REVIEWER_ID);
          assertThat(event.actorName()).isEqualTo("流程审批人");
          assertThat(event.comment()).isEqualTo("金额和业务说明已核验");
        });
    assertThat(jdbcTemplate.queryForObject(
        "select status from purchase_demands where id = ?", String.class, DEMAND_ID))
        .isEqualTo(PurchaseDemandStatus.APPROVED);
    assertThat(jdbcTemplate.queryForObject("""
        select department_id from workflow_business_instances
        where tenant_id = ? and business_type = ? and business_id = ?
        """, String.class, TENANT_ID, ApprovalBusinessType.PURCHASE_DEMAND, DEMAND_ID))
        .isEqualTo(DEPARTMENT_ID);
    assertThat(jdbcTemplate.queryForObject("""
        select count(*) from approval_tasks
        where tenant_id = ? and biz_type = ? and biz_id = ?
        """, Integer.class, TENANT_ID, ApprovalBusinessType.PURCHASE_DEMAND, DEMAND_ID)).isZero();
    assertThat(jdbcTemplate.queryForObject("select count(*) from process_instances", Integer.class)).isZero();
  }

  @Test
  void initiatorCanWithdrawRealRuntimePreservingHistoryAndResubmitANewInstance() {
    String demandId = DEMAND_ID + "-withdraw";
    TenantContext.set(TENANT_ID, null, REVIEWER_ID);
    var process = demandProcess();
    processDefinitionApplicationService.updateProcess(process.id(), new UpdateProcessDefinitionRequest(
        "采购需求撤回测试", "真实撤回", "draft", formSchema(), flowSchema(), ApprovalBusinessType.PURCHASE_DEMAND));
    processDefinitionApplicationService.publishProcess(process.id());
    jdbcTemplate.update("""
        insert into purchase_demands(id,tenant_id,title,department_id,requester_id,budget,status)
        values(?,?,'撤回需求',?,?,120000,'草稿')
        """, demandId, TENANT_ID, DEPARTMENT_ID, REQUESTER_ID);
    TenantContext.set(TENANT_ID, null, REQUESTER_ID);
    purchaseDemandApplicationService.submit(demandId, Map.of("reason", "申请", "urgency", "高"));
    var original = unifiedWorkflowApplicationService.getCurrentTenantBusinessHistory("purchase_demand", demandId);
    TenantContext.set(TENANT_ID, null, REVIEWER_ID);
    assertThatThrownBy(() -> unifiedWorkflowApplicationService.withdrawPurchaseDemand(original.workflowInstanceId(), "代撤回"))
        .isInstanceOf(PermissionDeniedException.class);
    TenantContext.set(TENANT_ID, null, REQUESTER_ID);
    unifiedWorkflowApplicationService.withdrawPurchaseDemand(original.workflowInstanceId(), "修改采购数量");
    assertThat(runtimeService.createProcessInstanceQuery().processInstanceId(original.flowableProcessInstanceId()).count()).isZero();
    assertThat(historyService.createHistoricProcessInstanceQuery().processInstanceId(original.flowableProcessInstanceId())
        .singleResult().getDeleteReason()).isEqualTo("修改采购数量");
    var cancelled = unifiedWorkflowApplicationService.getCurrentTenantHistory(original.workflowInstanceId());
    assertThat(cancelled.status()).isEqualTo("cancelled");
    assertThat(cancelled.events()).anySatisfy(event -> {
      assertThat(event.action()).isEqualTo("cancelled");
      assertThat(event.comment()).isEqualTo("修改采购数量");
      assertThat(event.actorId()).isEqualTo(REQUESTER_ID);
    });
    assertThat(jdbcTemplate.queryForObject("select status from purchase_demands where id=?", String.class, demandId))
        .isEqualTo("草稿");
    assertThatThrownBy(() -> unifiedWorkflowApplicationService.withdrawPurchaseDemand(original.workflowInstanceId(), "重复撤回"))
        .isInstanceOf(IllegalStateException.class);
    purchaseDemandApplicationService.submit(demandId, Map.of("reason", "修正后重提", "urgency", "高"));
    var restarted = unifiedWorkflowApplicationService.getCurrentTenantBusinessHistory("purchase_demand", demandId);
    assertThat(restarted.workflowInstanceId()).isNotEqualTo(original.workflowInstanceId());
    assertThat(restarted.flowableProcessInstanceId()).isNotEqualTo(original.flowableProcessInstanceId());
    assertThat(restarted.status()).isEqualTo("processing");
    TenantContext.set(TENANT_ID, null, REVIEWER_ID);
    var approved = unifiedWorkflowApplicationService.completeCurrentUserBusinessTask("purchase_demand", demandId, true, "确认");
    assertThat(approved.status()).isEqualTo("approved");
    var firstPage = unifiedWorkflowApplicationService.listCurrentTenantBusinessInstances("purchase_demand", demandId, 1, 1);
    var secondPage = unifiedWorkflowApplicationService.listCurrentTenantBusinessInstances("purchase_demand", demandId, 2, 1);
    assertThat(firstPage.total()).isEqualTo(2);
    assertThat(firstPage.items()).extracting(item -> item.workflowInstanceId()).containsExactly(restarted.workflowInstanceId());
    assertThat(secondPage.items()).extracting(item -> item.workflowInstanceId()).containsExactly(original.workflowInstanceId());
    assertThat(unifiedWorkflowApplicationService.getCurrentTenantHistory(original.workflowInstanceId()).formData())
        .containsEntry("reason", "申请");
    assertThat(unifiedWorkflowApplicationService.getCurrentTenantHistory(restarted.workflowInstanceId()).formData())
        .containsEntry("reason", "修正后重提");
    TenantContext.set(TENANT_ID, null, OUTSIDER_ID);
    assertThat(unifiedWorkflowApplicationService.listCurrentTenantBusinessInstances("purchase_demand", demandId, 1, 10).total()).isZero();
    TenantContext.set(TENANT_ID, null, REQUESTER_ID);
    assertThatThrownBy(() -> unifiedWorkflowApplicationService.withdrawPurchaseDemand(restarted.workflowInstanceId(), "已完成不能撤回"))
        .isInstanceOf(IllegalStateException.class);
  }

  private ProcessDefinitionResponse demandProcess() {
    return processDefinitionApplicationService.listCurrentTenantProcesses().stream()
        .filter(process -> ApprovalBusinessType.PURCHASE_DEMAND.equals(process.businessType()))
        .findFirst().orElseGet(() -> processDefinitionApplicationService.createProcess(
            new CreateProcessDefinitionRequest("采购需求审批", "集成测试流程", "file-text", ApprovalBusinessType.PURCHASE_DEMAND)));
  }

  private void insertUser(String id, String name, String departmentId) {
    jdbcTemplate.update("""
        insert into users (id, tenant_id, name, status, department_id)
        values (?, ?, ?, 'active', ?)
        on conflict (id) do nothing
        """, id, TENANT_ID, name, departmentId);
  }

  private void assignRole(String userId, String roleId) {
    jdbcTemplate.update("""
        insert into user_roles (user_id, role_id)
        values (?, ?)
        on conflict do nothing
        """, userId, roleId);
  }

  private static String formSchema() {
    return """
        {"fields":[
          {"id":"reason","type":"text","label":"申请说明","required":true,"options":[]},
          {"id":"urgency","type":"select","label":"紧急程度","required":true,"options":["高","普通"]}
        ]}
        """;
  }

  private static String flowSchema() {
    return """
        {"steps":[{
          "id":"amount_route","type":"condition","title":"金额路由","branches":[
            {"label":"大额采购","condition":{"field":"$amount","op":">=","value":"100000"},"steps":[
              {"id":"finance_review","type":"approver","title":"财务复核","assignment":{"type":"role","roleId":"role-workflow-reviewer-it"}}
            ]},
            {"label":"常规采购","condition":null,"steps":[
              {"id":"manager_review","type":"approver","title":"部门主管审批","assignment":{"type":"initiator_department_manager"}}
            ]}
          ]
        }]}
        """;
  }
}
