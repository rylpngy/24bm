package com.procurement.ludongpoc.application;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** POC 节点表单白名单。流程决定谁办理，本目录决定该节点能填写什么。 */
final class LudongPocTaskFormCatalog {
  private static final String REUSED_DECISION = "同工号审批复用（原节点已通过）";
  private static final Map<String, NodeForm> FORMS = Map.ofEntries(
      entry("argumentation_review", required("purchaseReason", "argumentationOpinion", "items"),
          "purchaseReason", "argumentationOpinion", "argumentationComment", "configurationStandard", "items"),
      entry("technical_leader_review", required("technicalLeaderOpinion"),
          "technicalLeaderOpinion", "technicalLeaderComment"),
      entry("compilation_participant_review", required("compilationParticipantOpinion"),
          "compilationParticipantOpinion", "compilationParticipantComment"),
      entry("mall_selection_participant_review", required("mallSelectionParticipantOpinion"),
          "mallSelectionParticipantOpinion", "mallSelectionParticipantComment"),
      entry("it_review", required("itReviewOpinion"), "itReviewOpinion", "itReviewComment"),
      entry("unit_review", required("applicantUnitOpinion"), "applicantUnitOpinion", "applicantUnitComment"),
      entry("funding_review", required("fundingUnitOpinion"), "fundingUnitOpinion", "fundingUnitComment"),
      entry("asset_configuration_review", required("exceedsPriceLimit", "exceedsQuantityLimit", "assetConfigurationOpinion"),
          "exceedsPriceLimit", "exceedsQuantityLimit", "assetConfigurationOpinion", "assetConfigurationComment"),
      entry("asset_division_leader_review", required("assetDivisionLeaderOpinion"),
          "assetDivisionLeaderOpinion", "assetDivisionLeaderComment"),
      entry("asset_unit_leader_review", required("assetUnitLeaderOpinion"),
          "assetUnitLeaderOpinion", "assetUnitLeaderComment"),
      entry("lab_equipment_review", required("largeEquipmentSharing", "labReviewOpinion"),
          "largeEquipmentSharing", "labReviewOpinion", "labReviewComment"),
      entry("lab_division_leader_review", required("labDivisionLeaderOpinion"),
          "labDivisionLeaderOpinion", "labDivisionLeaderComment"),
      entry("lab_unit_leader_review", required("labUnitLeaderOpinion"),
          "labUnitLeaderOpinion", "labUnitLeaderComment"),
      entry("school_leader_review", required("schoolLeaderOpinion"),
          "schoolLeaderOpinion", "schoolLeaderComment"),
      entry("finance_budget_review", required("financeBudgetStatus"),
          "financeBudgetStatus", "financeBudgetOpinion"),
      entry("procurement_budget_review", required("procurementBudgetStatus"),
          "procurementBudgetStatus", "procurementBudgetOpinion"),
      entry("handover_submit", required("handoverSubmitConfirmation"),
          "handoverSubmitConfirmation", "handoverSubmitComment"),
      entry("handover_accept", required("handoverAcceptance"),
          "handoverAcceptance", "handoverAcceptComment"),
      entry("procurement_method_review", required("procurementMethod"),
          "procurementMethod", "procurementMethodComment"),
      entry("finance_responsible_review", required("financeResponsibleOpinion"),
          "financeResponsibleOpinion", "financeResponsibleComment"));

  static String normalizeNodeId(String taskDefinitionKey) {
    if (taskDefinitionKey == null || taskDefinitionKey.isBlank()) {
      throw new IllegalArgumentException("审批任务缺少节点标识");
    }
    return taskDefinitionKey.startsWith("task_") ? taskDefinitionKey.substring(5) : taskDefinitionKey;
  }

  static Map<String, Object> validate(
      String nodeId, String action, Map<String, Object> reviewData) {
    NodeForm form = FORMS.get(nodeId);
    if (form == null) {
      throw new IllegalArgumentException("鲁东 POC 未配置节点表单: " + nodeId);
    }
    Map<String, Object> source = reviewData == null ? Map.of() : reviewData;
    for (String key : source.keySet()) {
      if (!form.allowed().contains(key)) {
        throw new IllegalArgumentException("当前审批节点不允许填写字段: " + key);
      }
    }
    Map<String, Object> normalized = new LinkedHashMap<>();
    source.forEach((key, value) -> {
      if (value != null && (!(value instanceof String text) || !text.isBlank())) {
        normalized.put(key, value);
      }
    });
    if ("approve".equals(action)) {
      for (String key : form.required()) {
        Object value = normalized.get(key);
        if (value == null || (value instanceof List<?> list && list.isEmpty())) {
          throw new IllegalArgumentException("审批通过前必须完成节点字段: " + key);
        }
      }
      if ("argumentation_review".equals(nodeId)) {
        validateArgumentationItems(normalized.get("items"));
      }
    }
    return Map.copyOf(normalized);
  }

  /**
   * 为按工号自动复用的目标节点生成可归档表单快照。
   * 仅复制同名字段和可等价映射的预算状态；不能从“已通过”推导的业务选项保留明确复用说明。
   */
  static Map<String, Object> reusedApprovalData(
      String nodeId, String sourceNodeId, Map<String, Object> sourceData) {
    NodeForm form = FORMS.get(nodeId);
    if (form == null) {
      throw new IllegalArgumentException("鲁东 POC 未配置节点表单: " + nodeId);
    }
    Map<String, Object> source = sourceData == null ? Map.of() : sourceData;
    Map<String, Object> reused = new LinkedHashMap<>();
    for (String field : form.allowed()) {
      Object value = source.get(field);
      if (value != null && (!(value instanceof String text) || !text.isBlank())) {
        reused.put(field, value);
      }
    }
    copyEquivalentBudgetStatus(reused, form, source, "financeBudgetStatus");
    copyEquivalentBudgetStatus(reused, form, source, "procurementBudgetStatus");
    for (String required : form.required()) {
      reused.computeIfAbsent(required, key -> reusedRequiredValue(key, source));
    }
    form.allowed().stream()
        .filter(field -> field.endsWith("Comment")
            || (field.endsWith("Opinion") && !form.required().contains(field)))
        .filter(field -> !reused.containsKey(field))
        .findFirst()
        .ifPresent(field -> reused.put(
            field, "同工号审批结论自动复用，来源节点：" + normalizeNodeId(sourceNodeId)));
    return Map.copyOf(reused);
  }

  private static void copyEquivalentBudgetStatus(
      Map<String, Object> target,
      NodeForm form,
      Map<String, Object> source,
      String targetField) {
    if (!form.allowed().contains(targetField) || target.containsKey(targetField)) return;
    String alternate = "financeBudgetStatus".equals(targetField)
        ? "procurementBudgetStatus"
        : "financeBudgetStatus";
    Object value = source.get(alternate);
    if (value != null && !String.valueOf(value).isBlank()) {
      target.put(targetField, value);
    }
  }

  private static Object reusedRequiredValue(String field, Map<String, Object> source) {
    if (field.endsWith("Opinion")) {
      return "同意";
    }
    if ("items".equals(field) && source.get("items") instanceof List<?> items) {
      return items;
    }
    if ("handoverSubmitConfirmation".equals(field)) {
      return "同工号前序节点已确认申请材料";
    }
    return REUSED_DECISION;
  }

  private static void validateArgumentationItems(Object raw) {
    if (!(raw instanceof List<?> items) || items.isEmpty()) {
      throw new IllegalArgumentException("论证环节至少需要填写一条设备配置明细");
    }
    for (Object item : items) {
      Map<?, ?> map = requireEquipmentItem(item, "设备配置明细");
      requirePositiveNumber(map, "unitPrice", "标准参考价格");
      requireItemText(map, "configurationLimit", "配置标准");
      requireItemText(map, "referenceBrands", "参考品牌型号");
      requireItemText(map, "technicalParameters", "主要技术参数");
    }
  }

  private static Map<?, ?> requireEquipmentItem(Object item, String label) {
    if (!(item instanceof Map<?, ?> map)
        || map.get("name") == null
        || String.valueOf(map.get("name")).isBlank()
        || map.get("quantity") == null
        || String.valueOf(map.get("quantity")).isBlank()) {
      throw new IllegalArgumentException(label + "必须包含设备名称和数量");
    }
    requirePositiveNumber(map, "quantity", "设备数量");
    return map;
  }

  private static void requireItemText(Map<?, ?> item, String field, String label) {
    Object value = item.get(field);
    if (value == null || String.valueOf(value).isBlank()) {
      throw new IllegalArgumentException(label + "不能为空");
    }
  }

  private static void requirePositiveNumber(Map<?, ?> item, String field, String label) {
    requireItemText(item, field, label);
    try {
      if (new BigDecimal(String.valueOf(item.get(field))).signum() <= 0) {
        throw new IllegalArgumentException(label + "必须大于 0");
      }
    } catch (NumberFormatException exception) {
      throw new IllegalArgumentException(label + "必须是有效数字", exception);
    }
  }

  private static Map.Entry<String, NodeForm> entry(
      String nodeId, Set<String> required, String... allowed) {
    return Map.entry(nodeId, new NodeForm(Set.of(allowed), required));
  }

  private static Set<String> required(String... fields) {
    return Set.of(fields);
  }

  private record NodeForm(Set<String> allowed, Set<String> required) {
  }

  private LudongPocTaskFormCatalog() {
  }
}
