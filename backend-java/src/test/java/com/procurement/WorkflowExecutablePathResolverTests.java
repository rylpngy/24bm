package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.workflow.definition.WorkflowDefinitionSchema;
import com.procurement.workflow.definition.WorkflowExecutablePathResolver;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class WorkflowExecutablePathResolverTests {

  @Test
  void resolvesOnlyTheMatchingAmountBranch() {
    List<WorkflowDefinitionSchema.FlowStep> steps = conditionalSteps();

    List<WorkflowDefinitionSchema.FlowStep> resolved = WorkflowExecutablePathResolver.resolve(
        steps, Map.of("amount", new BigDecimal("120000")));

    assertThat(resolved).extracting(WorkflowDefinitionSchema.FlowStep::id)
        .containsExactly("finance_review");
  }

  @Test
  void resolvesTheDefaultBranchWhenNoConditionMatches() {
    List<WorkflowDefinitionSchema.FlowStep> steps = conditionalSteps();

    List<WorkflowDefinitionSchema.FlowStep> resolved = WorkflowExecutablePathResolver.resolve(
        steps, Map.of("amount", new BigDecimal("1200")));

    assertThat(resolved).extracting(WorkflowDefinitionSchema.FlowStep::id)
        .containsExactly("manager_review");
  }

  private static List<WorkflowDefinitionSchema.FlowStep> conditionalSteps() {
    return List.of(new WorkflowDefinitionSchema.FlowStep(
        "amount_route",
        "condition",
        "金额路由",
        null,
        List.of(
            new WorkflowDefinitionSchema.FlowBranch(
                "大额采购",
                new WorkflowDefinitionSchema.Condition("$amount", ">=", "100000", new BigDecimal("100000")),
                List.of(new WorkflowDefinitionSchema.FlowStep(
                    "finance_review",
                    "approver",
                    "财务复核",
                    new WorkflowDefinitionSchema.Assignment("role", null, "role-buyer-owner"),
                    List.of()))),
            new WorkflowDefinitionSchema.FlowBranch(
                "常规采购",
                null,
                List.of(new WorkflowDefinitionSchema.FlowStep(
                    "manager_review",
                    "approver",
                    "部门主管审批",
                    new WorkflowDefinitionSchema.Assignment("initiator_department_manager", null, null),
                    List.of()))))));
  }
}
