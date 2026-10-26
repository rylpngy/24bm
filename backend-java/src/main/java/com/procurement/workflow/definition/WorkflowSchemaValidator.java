package com.procurement.workflow.definition;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

// 把前端 JSON 约束成可安全部署的工作流定义。发布失败必须明确指出配置位置，而不是由引擎运行时兜底。
@Component
public class WorkflowSchemaValidator {
  private static final Pattern IDENTIFIER = Pattern.compile("[A-Za-z][A-Za-z0-9_]{0,63}");
  private static final Set<String> FIELD_TYPES =
      Set.of("text", "textarea", "number", "money", "date", "select");
  private static final Set<String> STEP_TYPES = Set.of("approver", "auto", "condition");
  private static final Set<String> ASSIGNMENT_TYPES =
      Set.of("user", "role", "initiator_department_manager");
  private static final Set<String> OPERATORS = Set.of("<", "<=", ">", ">=", "==", "!=");

  private final ObjectMapper objectMapper;
  private final BuyerUserMapper buyerUserMapper;

  public WorkflowSchemaValidator(ObjectMapper objectMapper, BuyerUserMapper buyerUserMapper) {
    this.objectMapper = objectMapper;
    this.buyerUserMapper = buyerUserMapper;
  }

  public WorkflowDefinitionSchema validate(
      String tenantId, String formSchemaJson, String flowSchemaJson) {
    JsonNode formRoot = readObject(formSchemaJson, "formSchema");
    List<WorkflowDefinitionSchema.FormField> fields = parseFields(formRoot.path("fields"));
    Map<String, WorkflowDefinitionSchema.FormField> fieldsById = new LinkedHashMap<>();
    for (WorkflowDefinitionSchema.FormField field : fields) {
      fieldsById.put(field.id(), field);
    }

    JsonNode flowRoot = readObject(flowSchemaJson, "flowSchema");
    JsonNode stepsNode = flowRoot.path("steps");
    if (!stepsNode.isArray() || stepsNode.isEmpty()) {
      throw new IllegalArgumentException("flowSchema.steps must contain at least one approval step");
    }
    Set<String> stepIds = new HashSet<>();
    List<WorkflowDefinitionSchema.FlowStep> steps = parseSteps(
        tenantId, stepsNode, fieldsById, stepIds, "flowSchema.steps");
    if (!allPathsContainApprover(steps, false)) {
      throw new IllegalArgumentException(
          "Every executable workflow path must contain at least one approver step");
    }
    return new WorkflowDefinitionSchema(List.copyOf(fields), List.copyOf(steps));
  }

  // 发起时重新校验受控表单数据。未定义字段不允许进入 Flowable 变量，避免配置外数据参与条件判断。
  public Map<String, Object> validateStartData(
      WorkflowDefinitionSchema schema, Map<String, Object> rawValues) {
    Map<String, Object> source = rawValues == null ? Map.of() : rawValues;
    Map<String, Object> normalized = new LinkedHashMap<>();
    for (WorkflowDefinitionSchema.FormField field : schema.formFields()) {
      Object value = source.get(field.id());
      if (isBlankValue(value)) {
        if (field.required()) {
          throw new IllegalArgumentException("Required workflow form field is missing: " + field.label());
        }
        continue;
      }
      normalized.put(field.id(), normalizeValue(field, value));
    }
    for (String key : source.keySet()) {
      boolean known = schema.formFields().stream().anyMatch(field -> field.id().equals(key));
      if (!known) {
        throw new IllegalArgumentException("Unknown workflow form field: " + key);
      }
    }
    return normalized;
  }

  private List<WorkflowDefinitionSchema.FormField> parseFields(JsonNode fieldsNode) {
    if (!fieldsNode.isArray()) {
      throw new IllegalArgumentException("formSchema.fields must be an array");
    }
    List<WorkflowDefinitionSchema.FormField> fields = new ArrayList<>();
    Set<String> ids = new HashSet<>();
    for (int index = 0; index < fieldsNode.size(); index++) {
      JsonNode node = fieldsNode.get(index);
      String location = "formSchema.fields[" + index + "]";
      requireObject(node, location);
      String id = requiredText(node, "id", location);
      requireIdentifier(id, location + ".id");
      if (!ids.add(id)) {
        throw new IllegalArgumentException("Duplicate workflow form field id: " + id);
      }
      String type = requiredText(node, "type", location);
      if (!FIELD_TYPES.contains(type)) {
        throw new IllegalArgumentException("Unsupported workflow form field type: " + type);
      }
      String label = requiredText(node, "label", location);
      List<String> options = parseOptions(node.path("options"), "select".equals(type), location);
      fields.add(new WorkflowDefinitionSchema.FormField(
          id, type, label, node.path("required").asBoolean(false), options));
    }
    return fields;
  }

  private List<String> parseOptions(JsonNode optionsNode, boolean required, String location) {
    if (optionsNode.isMissingNode() || optionsNode.isNull()) {
      if (required) {
        throw new IllegalArgumentException(location + ".options must contain at least one option");
      }
      return List.of();
    }
    if (!optionsNode.isArray()) {
      throw new IllegalArgumentException(location + ".options must be an array");
    }
    List<String> options = new ArrayList<>();
    Set<String> unique = new HashSet<>();
    for (JsonNode option : optionsNode) {
      String value = textValue(option);
      if (value == null || value.isBlank()) {
        throw new IllegalArgumentException(location + ".options cannot contain blank values");
      }
      if (!unique.add(value.trim())) {
        throw new IllegalArgumentException(location + ".options cannot contain duplicate values");
      }
      options.add(value.trim());
    }
    if (required && options.isEmpty()) {
      throw new IllegalArgumentException(location + ".options must contain at least one option");
    }
    return List.copyOf(options);
  }

  private List<WorkflowDefinitionSchema.FlowStep> parseSteps(
      String tenantId,
      JsonNode stepsNode,
      Map<String, WorkflowDefinitionSchema.FormField> fieldsById,
      Set<String> stepIds,
      String location) {
    if (!stepsNode.isArray()) {
      throw new IllegalArgumentException(location + " must be an array");
    }
    List<WorkflowDefinitionSchema.FlowStep> steps = new ArrayList<>();
    for (int index = 0; index < stepsNode.size(); index++) {
      JsonNode node = stepsNode.get(index);
      String stepLocation = location + "[" + index + "]";
      requireObject(node, stepLocation);
      String id = requiredText(node, "id", stepLocation);
      requireIdentifier(id, stepLocation + ".id");
      if (!stepIds.add(id)) {
        throw new IllegalArgumentException("Duplicate workflow step id: " + id);
      }
      String type = requiredText(node, "type", stepLocation);
      if (!STEP_TYPES.contains(type)) {
        throw new IllegalArgumentException("Unsupported workflow step type: " + type);
      }
      String title = optionalText(node, "title");
      if (title == null || title.isBlank()) {
        title = "approver".equals(type) ? "审批" : "自动流转";
      }

      WorkflowDefinitionSchema.Assignment assignment = "approver".equals(type)
          ? parseAssignment(tenantId, node.path("assignment"), stepLocation)
          : null;
      List<WorkflowDefinitionSchema.FlowBranch> branches = "condition".equals(type)
          ? parseBranches(tenantId, node.path("branches"), fieldsById, stepIds, stepLocation)
          : List.of();
      Integer deadlineHours = null;
      if (node.hasNonNull("deadlineHours")) {
        JsonNode hours = node.get("deadlineHours");
        if (!"approver".equals(type) || !hours.isIntegralNumber() || !hours.canConvertToInt()
            || hours.intValue() < 1 || hours.intValue() > 8760) {
          throw new IllegalArgumentException(stepLocation + ".deadlineHours 须为1至8760之间的整数小时，且仅适用于审批节点");
        }
        deadlineHours = hours.intValue();
      }
      steps.add(new WorkflowDefinitionSchema.FlowStep(id, type, title.trim(), assignment, branches, deadlineHours));
    }
    return List.copyOf(steps);
  }

  private WorkflowDefinitionSchema.Assignment parseAssignment(
      String tenantId, JsonNode node, String location) {
    if (node.isMissingNode() || node.isNull() || !node.isObject()) {
      throw new IllegalArgumentException(
          location + ".assignment is required; legacy free-text assignee cannot be published");
    }
    String type = requiredText(node, "type", location + ".assignment");
    if (!ASSIGNMENT_TYPES.contains(type)) {
      throw new IllegalArgumentException("Unsupported workflow assignment type: " + type);
    }
    if ("user".equals(type)) {
      String userId = requiredText(node, "userId", location + ".assignment");
      BuyerUser user = buyerUserMapper.findByTenantAndId(tenantId, userId);
      if (user == null || !"active".equals(user.status())) {
        throw new IllegalArgumentException("Workflow assignee user is not active in tenant scope: " + userId);
      }
      return new WorkflowDefinitionSchema.Assignment(type, userId, null);
    }
    if ("role".equals(type)) {
      String roleId = requiredText(node, "roleId", location + ".assignment");
      if (!buyerUserMapper.existsBuyerRoleByTenantAndId(tenantId, roleId)) {
        throw new IllegalArgumentException("Workflow candidate role is not in tenant scope: " + roleId);
      }
      return new WorkflowDefinitionSchema.Assignment(type, null, roleId);
    }
    return new WorkflowDefinitionSchema.Assignment(type, null, null);
  }

  private List<WorkflowDefinitionSchema.FlowBranch> parseBranches(
      String tenantId,
      JsonNode branchesNode,
      Map<String, WorkflowDefinitionSchema.FormField> fieldsById,
      Set<String> stepIds,
      String location) {
    if (!branchesNode.isArray() || branchesNode.size() < 2) {
      throw new IllegalArgumentException(location + ".branches must contain at least two branches");
    }
    int defaults = 0;
    List<WorkflowDefinitionSchema.FlowBranch> branches = new ArrayList<>();
    for (int index = 0; index < branchesNode.size(); index++) {
      JsonNode branch = branchesNode.get(index);
      String branchLocation = location + ".branches[" + index + "]";
      requireObject(branch, branchLocation);
      JsonNode conditionNode = branch.path("condition");
      WorkflowDefinitionSchema.Condition condition = null;
      if (conditionNode.isMissingNode() || conditionNode.isNull()) {
        defaults++;
      } else {
        condition = parseCondition(conditionNode, fieldsById, branchLocation);
      }
      JsonNode branchSteps = branch.path("steps");
      if (!branchSteps.isArray()) {
        throw new IllegalArgumentException(branchLocation + ".steps must be an array");
      }
      branches.add(new WorkflowDefinitionSchema.FlowBranch(
          optionalText(branch, "label"),
          condition,
          parseSteps(tenantId, branchSteps, fieldsById, stepIds, branchLocation + ".steps")));
    }
    if (defaults != 1) {
      throw new IllegalArgumentException(location + ".branches must contain exactly one default branch");
    }
    return List.copyOf(branches);
  }

  private WorkflowDefinitionSchema.Condition parseCondition(
      JsonNode node,
      Map<String, WorkflowDefinitionSchema.FormField> fieldsById,
      String location) {
    requireObject(node, location + ".condition");
    String field = requiredText(node, "field", location + ".condition");
    String operator = requiredText(node, "op", location + ".condition");
    if (!OPERATORS.contains(operator)) {
      throw new IllegalArgumentException("Unsupported workflow condition operator: " + operator);
    }
    String value = requiredText(node, "value", location + ".condition");
    if ("$amount".equals(field)) {
      return new WorkflowDefinitionSchema.Condition(field, operator, value, parseNumber(value, location));
    }
    if ("$departmentId".equals(field)) {
      requireEqualityOperator(operator, location);
      return new WorkflowDefinitionSchema.Condition(field, operator, value, null);
    }
    WorkflowDefinitionSchema.FormField formField = fieldsById.get(field);
    if (formField == null) {
      throw new IllegalArgumentException("Workflow condition references unknown form field: " + field);
    }
    if (formField.numeric()) {
      return new WorkflowDefinitionSchema.Condition(field, operator, value, parseNumber(value, location));
    }
    requireEqualityOperator(operator, location);
    return new WorkflowDefinitionSchema.Condition(field, operator, value, null);
  }

  private static void requireEqualityOperator(String operator, String location) {
    if (!"==".equals(operator) && !"!=".equals(operator)) {
      throw new IllegalArgumentException(location + " only supports equality conditions for this field");
    }
  }

  // 从后向前计算每一条可执行路径是否一定经过人工审批节点。这样条件分支不能
  // 因某个“自动通过”分支而让业务状态在 Flowable 回调前直接结束。
  private boolean allPathsContainApprover(
      List<WorkflowDefinitionSchema.FlowStep> steps, boolean approverAfterSteps) {
    boolean guaranteed = approverAfterSteps;
    for (int index = steps.size() - 1; index >= 0; index--) {
      WorkflowDefinitionSchema.FlowStep step = steps.get(index);
      if ("approver".equals(step.type())) {
        guaranteed = true;
      } else if ("condition".equals(step.type())) {
        boolean allBranchesGuaranteed = !step.branches().isEmpty();
        for (WorkflowDefinitionSchema.FlowBranch branch : step.branches()) {
          if (!allPathsContainApprover(branch.steps(), guaranteed)) {
            allBranchesGuaranteed = false;
            break;
          }
        }
        guaranteed = allBranchesGuaranteed;
      }
    }
    return guaranteed;
  }

  private Object normalizeValue(WorkflowDefinitionSchema.FormField field, Object value) {
    String text = String.valueOf(value).trim();
    if (field.numeric()) {
      try {
        return new BigDecimal(text);
      } catch (NumberFormatException exception) {
        throw new IllegalArgumentException("Workflow form field must be numeric: " + field.label());
      }
    }
    if ("date".equals(field.type())) {
      try {
        LocalDate.parse(text);
      } catch (RuntimeException exception) {
        throw new IllegalArgumentException("Workflow form field must be an ISO date: " + field.label());
      }
      return text;
    }
    if ("select".equals(field.type()) && !field.options().contains(text)) {
      throw new IllegalArgumentException("Workflow form field value is not an allowed option: " + field.label());
    }
    return text;
  }

  private JsonNode readObject(String json, String name) {
    try {
      JsonNode node = objectMapper.readTree(json == null ? "" : json);
      if (node == null || !node.isObject()) {
        throw new IllegalArgumentException(name + " must be a JSON object");
      }
      return node;
    } catch (IllegalArgumentException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new IllegalArgumentException(name + " is not valid JSON", exception);
    }
  }

  private static String requiredText(JsonNode node, String field, String location) {
    String value = optionalText(node, field);
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(location + "." + field + " is required");
    }
    return value.trim();
  }

  private static String optionalText(JsonNode node, String field) {
    return textValue(node.path(field));
  }

  private static String textValue(JsonNode node) {
    if (node == null || node.isMissingNode() || node.isNull() || !node.isValueNode()) {
      return null;
    }
    return node.asText();
  }

  private static void requireObject(JsonNode node, String location) {
    if (node == null || !node.isObject()) {
      throw new IllegalArgumentException(location + " must be an object");
    }
  }

  private static void requireIdentifier(String value, String location) {
    if (!IDENTIFIER.matcher(value).matches()) {
      throw new IllegalArgumentException(
          location + " must start with a letter and contain only letters, numbers, or underscores");
    }
  }

  private static BigDecimal parseNumber(String value, String location) {
    try {
      return new BigDecimal(value);
    } catch (NumberFormatException exception) {
      throw new IllegalArgumentException(location + ".condition.value must be numeric", exception);
    }
  }

  private static boolean isBlankValue(Object value) {
    return value == null || (value instanceof String text && text.isBlank());
  }
}
