package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.workflow.definition.CompiledWorkflowBpmn;
import com.procurement.workflow.definition.FlowableProcessCompiler;
import com.procurement.workflow.definition.WorkflowDefinitionSchema;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;

class FlowableProcessCompilerTests {

  @Test
  void compilesCandidateRoleManagerAndAmountBranchIntoControlledBpmn() {
    WorkflowDefinitionSchema schema = new WorkflowDefinitionSchema(
        List.of(),
        List.of(new WorkflowDefinitionSchema.FlowStep(
            "amount_route",
            "condition",
            "金额路由",
            null,
            List.of(
                new WorkflowDefinitionSchema.FlowBranch(
                    "大额",
                    new WorkflowDefinitionSchema.Condition("$amount", ">=", "100000", new BigDecimal("100000")),
                    List.of(new WorkflowDefinitionSchema.FlowStep(
                        "finance_review", "approver", "财务复核",
                        new WorkflowDefinitionSchema.Assignment("role", null, "role-finance"), List.of()))),
                new WorkflowDefinitionSchema.FlowBranch(
                    "其他",
                    null,
                    List.of(new WorkflowDefinitionSchema.FlowStep(
                        "manager_review", "approver", "部门主管审批",
                        new WorkflowDefinitionSchema.Assignment("initiator_department_manager", null, null), List.of())))))));

    CompiledWorkflowBpmn compiled = new FlowableProcessCompiler().compile(
        "proc-demand", "purchase_demand", 2, "采购需求审批", schema, "tenant-1");
    String xml = new String(compiled.bpmnXml(), StandardCharsets.UTF_8);

    assertThat(compiled.processKey()).contains("purchase_demand_v2");
    assertThat(xml)
        .contains("role:tenant-1:role-finance")
        .contains("assignee_manager_review")
        .contains("${amount >= 100000}")
        .contains("end_approved")
        .contains("end_rejected");
  }
}
