package com.procurement.workflow.definition;

import java.math.BigDecimal;
import java.util.List;

// 发布前完成校验的流程配置对象。运行时和 BPMN 编译器只接受此结构，不直接消费前端 JSON。
public record WorkflowDefinitionSchema(
    List<FormField> formFields,
    List<FlowStep> steps) {

  public record FormField(
      String id,
      String type,
      String label,
      boolean required,
      List<String> options) {

    public boolean numeric() {
      return "number".equals(type) || "money".equals(type);
    }
  }

  public record FlowStep(
      String id,
      String type,
      String title,
      Assignment assignment,
      List<FlowBranch> branches) {
  }

  public record Assignment(
      String type,
      String userId,
      String roleId) {
  }

  public record FlowBranch(
      String label,
      Condition condition,
      List<FlowStep> steps) {
  }

  public record Condition(
      String field,
      String operator,
      String value,
      BigDecimal numericValue) {

    public boolean numeric() {
      return numericValue != null;
    }
  }
}
