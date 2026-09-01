package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.common.tenant.TenantContext;
import com.procurement.ludongpoc.api.CompleteLudongPocTaskRequest;
import com.procurement.ludongpoc.application.LudongPocApplicationService;
import com.procurement.process.api.CreateProcessDefinitionRequest;
import com.procurement.process.api.UpdateProcessDefinitionRequest;
import com.procurement.process.application.ProcessDefinitionApplicationService;
import com.procurement.workflow.api.UnifiedWorkflowTaskResponse;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowStartCommand;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
@EnabledIfSystemProperty(named = "ludong.reuse.it.jdbc", matches = ".+")
class LudongPocEmployeeReuseIT {
  private static final String TENANT_ID = "tenant-ldu-reuse-it";
  private static final String DEPARTMENT_ID = "dept-ldu-reuse-it";
  private static final String APPLICANT_ID = "user-ldu-reuse-applicant-it";
  private static final String REVIEWER_A_ID = "user-ldu-reuse-a-it";
  private static final String REVIEWER_B_ID = "user-ldu-reuse-b-it";
  private static final String REVIEWER_A_EMPLOYEE_NO = "LDU-REUSE-0001";
  private static final String APPLICATION_ID = "ldu-poc-reuse-it";
  private static final String APPLICANT_ROLE_ID = "role-ldu-reuse-applicant-it";
  private static final String REVIEWER_A_ROLE_ID = "role-ldu-reuse-a-it";
  private static final String REVIEWER_B_ROLE_ID = "role-ldu-reuse-b-it";

  @DynamicPropertySource
  static void registerProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", () -> System.getProperty("ludong.reuse.it.jdbc"));
    registry.add("spring.datasource.username", () -> System.getProperty(
        "ludong.reuse.it.username", "procurement"));
    registry.add("spring.datasource.password", () -> System.getProperty(
        "ludong.reuse.it.password", "procurement"));
    registry.add("keycloak.enabled", () -> false);
    registry.add("app.seed.locations", () -> "");
  }

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @Autowired
  private ProcessDefinitionApplicationService processDefinitionApplicationService;

  @Autowired
  private UnifiedWorkflowApplicationService workflowService;

  @Autowired
  private LudongPocApplicationService applicationService;

  @BeforeEach
  void setUp() {
    jdbcTemplate.update("""
        insert into tenants (id, name, plan, status)
        values (?, '鲁东工号复用测试', 'starter', 'active')
        on conflict (id) do nothing
        """, TENANT_ID);
    jdbcTemplate.update("""
        insert into departments (id, tenant_id, name, status)
        values (?, ?, '采购申报部门', 'active')
        on conflict (id) do nothing
        """, DEPARTMENT_ID, TENANT_ID);
    insertUser(APPLICANT_ID, "项目申报人", "LDU-REUSE-1000");
    insertUser(REVIEWER_A_ID, "复用审批人 A", REVIEWER_A_EMPLOYEE_NO);
    insertUser(REVIEWER_B_ID, "中间审批人 B", "LDU-REUSE-0002");
    insertRole(APPLICANT_ROLE_ID, "申报及流程管理");
    insertRole(REVIEWER_A_ROLE_ID, "重复审批岗位");
    insertRole(REVIEWER_B_ROLE_ID, "中间审批岗位");
    assignRole(APPLICANT_ID, APPLICANT_ROLE_ID);
    assignRole(REVIEWER_A_ID, REVIEWER_A_ROLE_ID);
    assignRole(REVIEWER_B_ID, REVIEWER_B_ROLE_ID);
    jdbcTemplate.update("""
        insert into ludong_poc_applications (
          id, tenant_id, application_no, project_name, applicant_unit, department_id,
          budget_amount, status, form_data, items, created_by, submitted_by, submitted_at
        ) values (?, ?, 'LDU-REUSE-IT-001', '非连续同工号复用验证', '教务处', ?,
          120000, 'in_approval', '{}'::jsonb, '[]'::jsonb, ?, ?, now())
        on conflict (id) do nothing
        """, APPLICATION_ID, TENANT_ID, DEPARTMENT_ID, APPLICANT_ID, APPLICANT_ID);
  }

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void reusesNonAdjacentApprovalAndPersistsEveryBusinessProjection() {
    TenantContext.set(TENANT_ID, null, APPLICANT_ID);
    var definition = processDefinitionApplicationService.createProcess(
        new CreateProcessDefinitionRequest(
            "鲁东非连续工号复用", "A-B-A 流程验收", "workflow",
            ApprovalBusinessType.LUDONG_PROJECT_APPLICATION));
    processDefinitionApplicationService.updateProcess(
        definition.id(),
        new UpdateProcessDefinitionRequest(
            "鲁东非连续工号复用",
            "验证中间间隔其他人时仍按整个实例工号查重。",
            "draft",
            "{\"fields\":[]}",
            flowSchema(),
            ApprovalBusinessType.LUDONG_PROJECT_APPLICATION));
    processDefinitionApplicationService.publishProcess(definition.id());
    workflowService.start(new WorkflowStartCommand(
        ApprovalBusinessType.LUDONG_PROJECT_APPLICATION,
        APPLICATION_ID,
        DEPARTMENT_ID,
        new BigDecimal("120000"),
        Map.of(),
        Map.of("projectName", "非连续同工号复用验证")));

    TenantContext.set(TENANT_ID, null, REVIEWER_A_ID);
    UnifiedWorkflowTaskResponse firstA = onlyTask();
    assertThat(firstA.taskDefinitionKey()).endsWith("unit_review");
    applicationService.completeTask(
        firstA.taskId(),
        new CompleteLudongPocTaskRequest(
            APPLICATION_ID,
            "unit_review",
            "approve",
            "申报单位意见已确认",
            Map.of(
                "applicantUnitOpinion", "同意",
                "applicantUnitComment", "申报材料齐全")));

    TenantContext.set(TENANT_ID, null, REVIEWER_B_ID);
    UnifiedWorkflowTaskResponse middleB = onlyTask();
    assertThat(middleB.taskDefinitionKey()).endsWith("finance_budget_review");
    var completed = applicationService.completeTask(
        middleB.taskId(),
        new CompleteLudongPocTaskRequest(
            APPLICATION_ID,
            "finance_budget_review",
            "approve",
            "预算已核验",
            Map.of(
                "financeBudgetStatus", "本项目已列入本年度学校预算",
                "financeBudgetOpinion", "预算来源清晰")));

    assertThat(completed.status()).isEqualTo("approved");
    assertThat(workflowService.listCurrentUserTasks()).isEmpty();
    var history = workflowService.getCurrentTenantBusinessHistory(
        ApprovalBusinessType.LUDONG_PROJECT_APPLICATION, APPLICATION_ID);
    assertThat(history.events())
        .filteredOn(event -> event.nodeId().endsWith("funding_review") && "approved".equals(event.action()))
        .singleElement()
        .satisfies(event -> {
          assertThat(event.actorId()).isEqualTo(REVIEWER_A_ID);
          assertThat(event.comment()).contains(REVIEWER_A_EMPLOYEE_NO, "unit_review", "自动复用结论");
        });

    Map<String, Object> reusedForm = jdbcTemplate.queryForMap("""
        select reviewer_id, decision,
               review_data ->> 'fundingUnitOpinion' as opinion,
               review_data ->> 'fundingUnitComment' as form_comment
        from ludong_poc_review_records
        where tenant_id = ? and application_id = ? and node_id = 'funding_review'
        """, TENANT_ID, APPLICATION_ID);
    assertThat(reusedForm)
        .containsEntry("reviewer_id", REVIEWER_A_ID)
        .containsEntry("decision", "approve")
        .containsEntry("opinion", "同意");
    assertThat(String.valueOf(reusedForm.get("form_comment"))).contains("unit_review");
    assertThat(workflowService.listApprovalSignatures(
        ApprovalBusinessType.LUDONG_PROJECT_APPLICATION, APPLICATION_ID))
        .filteredOn(signature -> signature.nodeId().endsWith("funding_review"))
        .singleElement()
        .satisfies(signature -> assertThat(signature.actorName()).isEqualTo("复用审批人 A"));
    assertThat(jdbcTemplate.queryForObject("""
        select count(*) from audit_logs
        where tenant_id = ? and target_id = ? and actor_id = ?
          and action in ('workflow.task.reused', 'ludong_poc.approval_reused')
        """, Integer.class, TENANT_ID, APPLICATION_ID, REVIEWER_A_ID)).isEqualTo(2);
  }

  private UnifiedWorkflowTaskResponse onlyTask() {
    List<UnifiedWorkflowTaskResponse> tasks = workflowService.listCurrentUserTasks();
    assertThat(tasks).hasSize(1);
    return tasks.getFirst();
  }

  private void insertUser(String id, String name, String employeeNo) {
    jdbcTemplate.update("""
        insert into users (id, tenant_id, name, status, department_id, employee_no)
        values (?, ?, ?, 'active', ?, ?)
        on conflict (id) do nothing
        """, id, TENANT_ID, name, DEPARTMENT_ID, employeeNo);
  }

  private void insertRole(String id, String name) {
    jdbcTemplate.update("""
        insert into roles (id, tenant_id, scope, name, permissions, data_scope)
        values (?, ?, 'buyer', ?, '["buyer:*"]'::jsonb, 'all')
        on conflict (id) do nothing
        """, id, TENANT_ID, name);
  }

  private void assignRole(String userId, String roleId) {
    jdbcTemplate.update("""
        insert into user_roles (user_id, role_id) values (?, ?)
        on conflict do nothing
        """, userId, roleId);
  }

  private static String flowSchema() {
    return """
        {"steps":[
          {"id":"unit_review","type":"approver","title":"申报单位负责人审核","assignment":{"type":"role","roleId":"role-ldu-reuse-a-it"}},
          {"id":"finance_budget_review","type":"approver","title":"财务预算审核","assignment":{"type":"role","roleId":"role-ldu-reuse-b-it"}},
          {"id":"funding_review","type":"approver","title":"经费主管单位审核","assignment":{"type":"role","roleId":"role-ldu-reuse-a-it"}}
        ]}
        """;
  }
}
