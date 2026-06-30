package com.procurement.process.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

// 按表单取值解析审批路径:条件节点取首个命中分支(无命中取「其他情况」或首个),递归展开。
// 与前端 evaluateFlow 同语义。
public final class FlowEvaluator {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private FlowEvaluator() {}

  public static List<ResolvedStep> evaluate(String flowSchemaJson, Map<String, String> formValues) {
    List<ResolvedStep> path = new ArrayList<>();
    try {
      JsonNode steps = OBJECT_MAPPER.readTree(flowSchemaJson == null ? "{}" : flowSchemaJson).path("steps");
      walk(steps, formValues, path);
    } catch (Exception ignored) {
      // schema 非法 → 空路径(即无审批节点)。
    }
    return path;
  }

  private static void walk(JsonNode steps, Map<String, String> values, List<ResolvedStep> path) {
    if (steps == null || !steps.isArray()) {
      return;
    }
    for (JsonNode s : steps) {
      String type = s.path("type").asText("");
      if ("condition".equals(type)) {
        JsonNode branches = s.path("branches");
        int idx = pickBranch(branches, values);
        if (idx >= 0) {
          walk(branches.get(idx).path("steps"), values, path);
        }
      } else if ("approver".equals(type)) {
        path.add(new ResolvedStep("approver", s.path("title").asText("审批人"), s.path("assignee").asText(null)));
      } else if ("auto".equals(type)) {
        path.add(new ResolvedStep("auto", s.path("title").asText("系统自动通过"), null));
      }
    }
  }

  private static int pickBranch(JsonNode branches, Map<String, String> values) {
    if (branches == null || !branches.isArray() || branches.isEmpty()) {
      return -1;
    }
    for (int i = 0; i < branches.size(); i++) {
      JsonNode cond = branches.get(i).path("condition");
      if (cond.isObject() && matches(cond, values)) {
        return i;
      }
    }
    // 无命中:取「其他情况」(无 condition)分支,否则首个。
    for (int i = 0; i < branches.size(); i++) {
      if (!branches.get(i).path("condition").isObject()) {
        return i;
      }
    }
    return 0;
  }

  private static boolean matches(JsonNode cond, Map<String, String> values) {
    String field = cond.path("field").asText("");
    String op = cond.path("op").asText("");
    double threshold = cond.path("value").asDouble(Double.NaN);
    String raw = values == null ? null : values.get(field);
    if (raw == null || raw.isBlank() || Double.isNaN(threshold)) {
      return false;
    }
    double n;
    try {
      n = Double.parseDouble(raw.trim());
    } catch (NumberFormatException e) {
      return false;
    }
    return switch (op) {
      case "<" -> n < threshold;
      case "<=" -> n <= threshold;
      case ">" -> n > threshold;
      case ">=" -> n >= threshold;
      case "==" -> n == threshold;
      case "!=" -> n != threshold;
      default -> false;
    };
  }
}
