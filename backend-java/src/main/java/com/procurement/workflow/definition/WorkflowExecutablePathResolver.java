package com.procurement.workflow.definition;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Resolves the configured branch path using the same controlled variables Flowable receives. */
public final class WorkflowExecutablePathResolver {
  private WorkflowExecutablePathResolver() {}

  public static List<WorkflowDefinitionSchema.FlowStep> resolve(
      List<WorkflowDefinitionSchema.FlowStep> steps,
      Map<String, Object> variables) {
    List<WorkflowDefinitionSchema.FlowStep> resolved = new ArrayList<>();
    appendResolvedSteps(resolved, steps, variables == null ? Map.of() : variables);
    return List.copyOf(resolved);
  }

  private static void appendResolvedSteps(
      List<WorkflowDefinitionSchema.FlowStep> resolved,
      List<WorkflowDefinitionSchema.FlowStep> steps,
      Map<String, Object> variables) {
    for (WorkflowDefinitionSchema.FlowStep step : steps) {
      if (!"condition".equals(step.type())) {
        resolved.add(step);
        continue;
      }
      WorkflowDefinitionSchema.FlowBranch branch = step.branches().stream()
          .filter(item -> item.condition() != null && matches(item.condition(), variables))
          .findFirst()
          .orElseGet(() -> step.branches().stream()
              .filter(item -> item.condition() == null)
              .findFirst()
              .orElseThrow(() -> new IllegalStateException(
                  "Workflow condition is missing a default branch: " + step.id())));
      appendResolvedSteps(resolved, branch.steps(), variables);
    }
  }

  private static boolean matches(
      WorkflowDefinitionSchema.Condition condition,
      Map<String, Object> variables) {
    Object rawValue = variables.get(variableName(condition.field()));
    if (rawValue == null) {
      return false;
    }
    if (condition.numeric()) {
      BigDecimal actual;
      try {
        actual = new BigDecimal(String.valueOf(rawValue));
      } catch (NumberFormatException exception) {
        return false;
      }
      int comparison = actual.compareTo(condition.numericValue());
      return switch (condition.operator()) {
        case "<" -> comparison < 0;
        case "<=" -> comparison <= 0;
        case ">" -> comparison > 0;
        case ">=" -> comparison >= 0;
        case "==" -> comparison == 0;
        case "!=" -> comparison != 0;
        default -> false;
      };
    }
    int comparison = String.valueOf(rawValue).compareTo(condition.value());
    return switch (condition.operator()) {
      case "==" -> comparison == 0;
      case "!=" -> comparison != 0;
      default -> false;
    };
  }

  private static String variableName(String field) {
    return switch (field) {
      case "$amount" -> "amount";
      case "$departmentId" -> "departmentId";
      default -> "form_" + field;
    };
  }
}
