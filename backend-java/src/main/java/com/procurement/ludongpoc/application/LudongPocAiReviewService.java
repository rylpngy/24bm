package com.procurement.ludongpoc.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.ludongpoc.api.LudongPocAiReviewFinding;
import com.procurement.ludongpoc.api.LudongPocAiReviewResponse;
import com.procurement.ludongpoc.api.LudongPocAiEvidenceReference;
import com.procurement.ludongpoc.api.LudongPocApplicationResponse;
import com.procurement.ludongpoc.api.LudongPocPriorApprovalEvidence;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * 审批节点智能辅助评审。可配置 OpenAI 兼容接口；未配置或调用失败时，
 * 使用可复现的采购规则模型进行辅助分析，不自动作出审批决定。
 */
@Service
public class LudongPocAiReviewService {
  private static final String RULE_MODEL = "24Bid 采购智能评审规则模型";
  private static final Map<String, NodeProfile> PROFILES = profiles();

  private final ObjectMapper objectMapper;
  private final String endpoint;
  private final String apiKey;
  private final String model;
  private final HttpClient httpClient;
  private final LudongPocAiKnowledgeBase knowledgeBase;

  public LudongPocAiReviewService(
      ObjectMapper objectMapper,
      LudongPocAiKnowledgeBase knowledgeBase,
      @Value("${procurement.ludong-poc.ai-review.endpoint:}") String endpoint,
      @Value("${procurement.ludong-poc.ai-review.api-key:}") String apiKey,
      @Value("${procurement.ludong-poc.ai-review.model:gpt-4.1-mini}") String model) {
    this.objectMapper = objectMapper;
    this.knowledgeBase = knowledgeBase;
    this.endpoint = endpoint == null ? "" : endpoint.trim();
    this.apiKey = apiKey == null ? "" : apiKey.trim();
    this.model = model == null || model.isBlank() ? "gpt-4.1-mini" : model.trim();
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
  }

  public LudongPocAiReviewResponse review(
      LudongPocApplicationResponse application,
      String rawNodeId,
      Map<String, Object> currentReviewData) {
    return review(application, rawNodeId, currentReviewData, List.of());
  }

  public LudongPocAiReviewResponse review(
      LudongPocApplicationResponse application,
      String rawNodeId,
      Map<String, Object> currentReviewData,
      List<LudongPocPriorApprovalEvidence> priorApprovals) {
    LudongPocAiReviewResponse local = reviewRulesOnly(
        application, rawNodeId, currentReviewData, priorApprovals);
    if (endpoint.isBlank()) {
      return local;
    }
    String nodeId = normalizeNodeId(rawNodeId);
    NodeProfile profile = PROFILES.getOrDefault(nodeId, new NodeProfile(
        "采购项目审批", List.of("项目基本信息", "预算与材料完整性", "前序审批意见")));
    Map<String, Object> current = currentReviewData == null ? Map.of() : currentReviewData;
    List<LudongPocPriorApprovalEvidence> prior = priorApprovals == null ? List.of() : priorApprovals;
    try {
      return remoteReview(application, nodeId, profile, current, prior, local);
    } catch (Exception ignored) {
      return new LudongPocAiReviewResponse(
          local.runId(), "RULE_FALLBACK", RULE_MODEL, knowledgeBase.version(),
          OffsetDateTime.now(), local.nodeName(),
          local.summary(), local.recommendation(), local.confidence(), local.reviewFocus(),
          local.findings(), local.missingMaterials(), local.suggestedComment(), local.accuracyNotice());
    }
  }

  public LudongPocAiReviewResponse reviewRulesOnly(
      LudongPocApplicationResponse application,
      String rawNodeId,
      Map<String, Object> currentReviewData,
      List<LudongPocPriorApprovalEvidence> priorApprovals) {
    String nodeId = normalizeNodeId(rawNodeId);
    NodeProfile profile = PROFILES.getOrDefault(nodeId, new NodeProfile(
        "采购项目审批", List.of("项目基本信息", "预算与材料完整性", "前序审批意见")));
    Map<String, Object> current = currentReviewData == null ? Map.of() : currentReviewData;
    List<LudongPocPriorApprovalEvidence> prior = priorApprovals == null ? List.of() : priorApprovals;
    return localReview(application, nodeId, profile, current, prior);
  }

  private LudongPocAiReviewResponse localReview(
      LudongPocApplicationResponse application,
      String nodeId,
      NodeProfile profile,
      Map<String, Object> current,
      List<LudongPocPriorApprovalEvidence> priorApprovals) {
    Map<String, Object> form = application.formData() == null ? Map.of() : application.formData();
    List<Map<String, Object>> items = application.items() == null ? List.of() : application.items();
    List<LudongPocAiReviewFinding> findings = new ArrayList<>();
    List<String> missing = new ArrayList<>();

    addCoreFindings(application, form, items, findings, missing);
    addNodeFindings(application, nodeId, form, items, current, findings, missing);
    findings = groundFindings(application, form, current, nodeId, priorApprovals, findings);

    long riskCount = findings.stream().filter(item -> "risk".equals(item.level())).count();
    long warningCount = findings.stream().filter(item -> "warning".equals(item.level())).count();
    String recommendation = riskCount > 0 ? "建议补充材料后审批"
        : warningCount > 0 ? "建议重点复核" : "具备继续审批条件";
    int confidence = riskCount > 0 ? 68 : warningCount > 0 ? 82 : 92;
    String summary = String.format(
        "已围绕%s的 %d 项审查重点完成辅助分析，识别 %d 项风险、%d 项需复核内容。",
        profile.name(), profile.focus().size(), riskCount, warningCount);
    String suggestedComment = riskCount > 0
        ? "经辅助核验，当前申报仍存在材料或数据缺项，建议按风险提示补充完善后再行审批。"
        : warningCount > 0
          ? "经辅助核验，项目基本材料已具备，建议重点复核预算、设备参数及当前节点提示项后办理。"
          : "经辅助核验，当前项目基本信息、设备明细和前序材料未发现明显缺项，具备继续审批条件。";
    return new LudongPocAiReviewResponse(
        "ai-run-" + UUID.randomUUID(), "RULE_ASSISTED", RULE_MODEL, knowledgeBase.version(),
        OffsetDateTime.now(), profile.name(), summary, recommendation, confidence, profile.focus(),
        findings, List.copyOf(missing), suggestedComment,
        "置信度表示当前材料对规则与模型分析的支撑程度，不代表结论正确率；辅助结果须由审批人复核确认。");
  }

  private void addCoreFindings(
      LudongPocApplicationResponse application,
      Map<String, Object> form,
      List<Map<String, Object>> items,
      List<LudongPocAiReviewFinding> findings,
      List<String> missing) {
    List<String> absent = new ArrayList<>();
    required(absent, application.projectName(), "采购项目名称");
    required(absent, application.applicantUnit(), "申报单位");
    required(absent, form.get("fundingSource"), "经费来源");
    required(absent, form.get("projectLeaderName"), "项目负责人");
    required(absent, form.get("technicalLeaderName"), "技术负责人");
    if (!absent.isEmpty()) {
      missing.addAll(absent);
      findings.add(finding("risk", "基础材料存在缺项",
          "缺少：" + String.join("、", absent), "项目申报表"));
    } else {
      findings.add(finding("passed", "基础申报信息已具备",
          "项目、单位、经费来源及负责人均已填写。", "项目申报表"));
    }

    if (items.isEmpty()) {
      missing.add("拟采购设备配置明细");
      findings.add(finding("risk", "设备明细未填写",
          "未找到可用于审查的拟采购设备清单。", "设备配置明细"));
      return;
    }
    long incompleteItems = items.stream().filter(item -> blank(item.get("name"))
        || number(item.get("quantity")).compareTo(BigDecimal.ZERO) <= 0
        || blank(item.get("technicalParameters"))).count();
    if (incompleteItems > 0) {
      findings.add(finding("warning", "设备参数需复核",
          incompleteItems + " 项设备存在名称、数量或技术参数不完整的情况。", "设备配置明细"));
    } else {
      findings.add(finding("passed", "设备明细基本完整",
          "共 " + items.size() + " 项设备，名称、数量和技术参数均已填写。", "设备配置明细"));
    }

    BigDecimal itemTotal = items.stream().map(item -> number(item.get("totalPrice")))
        .reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal budget = application.budgetAmount() == null ? BigDecimal.ZERO : application.budgetAmount();
    BigDecimal difference = budget.subtract(itemTotal).abs();
    BigDecimal tolerance = budget.multiply(new BigDecimal("0.01")).max(new BigDecimal("1"));
    if (difference.compareTo(tolerance) > 0) {
      findings.add(finding("warning", "预算与明细合计存在差异",
          "申报预算 " + money(budget) + "，设备明细合计 " + money(itemTotal)
              + "，建议核对差额原因。", "预算金额 / 设备明细"));
    } else {
      findings.add(finding("passed", "预算与设备明细基本一致",
          "申报预算与明细合计差异在 1% 容差内。", "预算金额 / 设备明细"));
    }

    if ("是".equals(text(form.get("mallSelectionApplicable")))) {
      long incompleteSelections = items.stream().filter(item -> blank(item.get("selectedBrand"))
          || blank(item.get("selectedModel"))
          || blank(item.get("selectedSupplier"))
          || number(item.get("selectedUnitPrice")).compareTo(BigDecimal.ZERO) <= 0
          || blank(item.get("selectionParticipants"))).count();
      if (incompleteSelections > 0) {
        missing.add("网上商城型号确认单");
        findings.add(finding("risk", "商城型号确认信息不完整",
            incompleteSelections + " 项设备尚未完成品牌、型号、供应商、价格或参与人确认。",
            "网上商城型号确认单"));
      } else {
        findings.add(finding("passed", "商城型号确认单已完成",
            "全部 " + items.size() + " 项设备均已记录商城选型依据和参与人员。",
            "网上商城型号确认单"));
      }
      long overpricedSelections = items.stream().filter(item -> {
        BigDecimal requested = number(item.get("unitPrice"));
        BigDecimal selected = number(item.get("selectedUnitPrice"));
        return requested.signum() > 0 && selected.compareTo(requested) > 0;
      }).count();
      if (overpricedSelections > 0) {
        findings.add(finding("risk", "商城选型价格超过申报单价",
            overpricedSelections + " 项商品的商城选型单价高于购置申请单价，不应直接进入后续审批。",
            "预算单价 / 商城选型单价"));
      }
      long insufficientParticipants = items.stream().filter(item ->
          participantCount(item.get("selectionParticipants")) < 3).count();
      if (insufficientParticipants > 0) {
        findings.add(finding("risk", "商城选型参与人数不足",
            insufficientParticipants + " 项商品的选型参与人少于三人；处级领导身份仍需审批人结合组织岗位确认。",
            "网上商城型号确认单 / 组织岗位"));
      }
    }
  }

  private void addNodeFindings(
      LudongPocApplicationResponse application,
      String nodeId,
      Map<String, Object> form,
      List<Map<String, Object>> items,
      Map<String, Object> current,
      List<LudongPocAiReviewFinding> findings,
      List<String> missing) {
    switch (nodeId) {
      case "argumentation_review" -> {
        if (blank(current.get("purchaseReason")) && blank(form.get("purchaseReason"))) {
          missing.add("购置理由及必要性论证");
          findings.add(finding("warning", "必要性论证待补充",
              "建议结合现有设备情况、使用场景和预期目标说明购置必要性。", "当前节点表单"));
        }
        long withoutBrands = items.stream().filter(item -> blank(item.get("referenceBrands"))).count();
        if (withoutBrands > 0) {
          findings.add(finding("warning", "参考品牌型号信息不完整",
              withoutBrands + " 项设备未填写参考品牌或型号，建议同时核验是否存在倾向性描述。", "设备配置明细"));
        }
      }
      case "technical_leader_review" -> findings.add(finding("warning", "技术方案责任确认",
          "请核对设备技术参数、安装条件、接口兼容性和验收指标是否可执行、可验证。",
          "采购需求表 / 设备配置明细"));
      case "compilation_participant_review" -> findings.add(finding("warning", "采购需求编制一致性",
          "请确认项目目标、技术参数、服务要求和设备清单不存在前后矛盾或遗漏。",
          "采购需求表完整字段"));
      case "mall_selection_participant_review" -> findings.add(finding("warning", "商城选型依据复核",
          "请逐项核对品牌型号、商城供应商、商品链接、价格及选型参与人员记录。",
          "网上商城型号确认单"));
      case "it_review" -> findings.add(finding(
          "是".equals(text(form.get("requiresItReview"))) ? "warning" : "passed",
          "信创适配范围核验",
          "是".equals(text(form.get("requiresItReview")))
              ? "系统已判定项目涉及信创产品，建议核对芯片、操作系统、软件生态及网络安全适配说明。"
              : "当前项目未被标记为信创审查对象，建议结合设备清单再次确认。",
          "流程判定记录"));
      case "unit_review" -> findings.add(finding("passed", "申报单位责任信息",
          "项目负责人为 " + fallback(form.get("projectLeaderName"))
              + "，技术负责人为 " + fallback(form.get("technicalLeaderName")) + "。",
          "项目申报表"));
      case "funding_review", "finance_budget_review", "procurement_budget_review" -> {
        String source = text(form.get("fundingSource"));
        if (source.isBlank()) {
          missing.add("经费来源及预算依据");
          findings.add(finding("risk", "预算依据不完整",
              "未找到经费来源，无法完成预算归属核验。", "预算与经费信息"));
        } else {
          findings.add(finding("passed", "经费来源已明确",
              "申报经费来源为“" + source + "”，预算金额为 " + money(application.budgetAmount()) + "。",
              "预算与经费信息"));
        }
      }
      case "asset_configuration_review", "asset_division_leader_review", "asset_unit_leader_review" -> {
        long missingStandards = items.stream().filter(item -> blank(item.get("configurationLimit"))).count();
        findings.add(finding(missingStandards > 0 ? "warning" : "passed",
            "配置标准和数量上限核验",
            missingStandards > 0
                ? missingStandards + " 项设备尚未关联附件三具体配置标准，须由资产审核人补充核验。"
                : "全部设备均已记录配置标准依据，仍需资产审核人确认标准版本和适用范围。",
            "附件 3 / 设备配置明细"));
      }
      case "lab_equipment_review", "lab_division_leader_review", "lab_unit_leader_review" ->
          findings.add(finding("warning", "大型仪器共享及使用条件",
              "建议核对设备共享方案、安装场地、水电环境和预计使用率。", "设备明细 / 实验室条件"));
      case "school_leader_review" -> findings.add(finding(
          "是".equals(text(form.get("requiresSchoolLeader"))) ? "warning" : "passed",
          "分管校领导审批条件",
          "是".equals(text(form.get("requiresSchoolLeader")))
              ? "项目已按申报单位类型和预算金额命中校领导审批路径，建议核对必要性及预算安排。"
              : "当前项目未命中校领导审批金额条件。",
          "流程条件判定"));
      case "handover_submit", "handover_accept" -> findings.add(finding("warning", "归档材料齐套性",
          "建议核对采购需求表、采购申请单、设备明细及已完成审批签字是否齐全。", "申请材料包"));
      case "procurement_method_review" -> findings.add(finding("warning", "采购方式需结合现行制度判定",
          "项目预算为 " + money(application.budgetAmount())
              + "，请结合采购品目、预算金额、市场竞争情况和学校现行制度选择方式。",
          "项目预算 / 采购政策"));
      case "finance_responsible_review" -> findings.add(finding("warning", "全流程意见一致性",
          "终审前建议核对论证、资产、实验室、预算及采购方式意见是否完整且无冲突。", "完整审批历史"));
      default -> { }
    }
  }

  private LudongPocAiReviewResponse remoteReview(
      LudongPocApplicationResponse application,
      String nodeId,
      NodeProfile profile,
      Map<String, Object> current,
      List<LudongPocPriorApprovalEvidence> priorApprovals,
      LudongPocAiReviewResponse local) throws Exception {
    Map<String, Object> context = new LinkedHashMap<>();
    context.put("nodeId", nodeId);
    context.put("nodeName", profile.name());
    context.put("reviewFocus", profile.focus());
    context.put("application", application);
    context.put("currentReviewData", current);
    context.put("priorApprovals", priorApprovals);
    context.put("knowledgeVersion", knowledgeBase.version());
    context.put("ruleAnalysis", local);
    String system = "你是高校采购审批辅助员。仅做辅助研判，不代替审批人作决定。"
        + "请结合当前节点重点和规则分析输出 JSON，不要输出法律结论。"
        + "只能使用 ruleAnalysis.findings 中已有的 findingId，并保留其证据关系，不得虚构制度条款。"
        + "字段：summary,recommendation,confidence,reviewFocus,findings,missingMaterials,suggestedComment；"
        + "findings 元素字段为 findingId,level(passed/warning/risk),title,detail。";
    Map<String, Object> payload = Map.of(
        "model", model,
        "temperature", 0.1,
        "response_format", Map.of("type", "json_object"),
        "messages", List.of(
            Map.of("role", "system", "content", system),
            Map.of("role", "user", "content", objectMapper.writeValueAsString(context))));
    HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(endpoint))
        .timeout(Duration.ofSeconds(20))
        .header("Content-Type", "application/json");
    if (!apiKey.isBlank()) {
      request.header("Authorization", "Bearer " + apiKey);
    }
    HttpResponse<String> response = httpClient.send(
        request.POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload))).build(),
        HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw new IllegalStateException("AI review HTTP " + response.statusCode());
    }
    JsonNode root = objectMapper.readTree(response.body());
    String content = root.path("choices").path(0).path("message").path("content").asText();
    JsonNode result = objectMapper.readTree(content);
    List<String> focus = readStrings(result.path("reviewFocus"), profile.focus());
    List<String> missing = readStrings(result.path("missingMaterials"), local.missingMaterials());
    Map<String, LudongPocAiReviewFinding> grounded = new LinkedHashMap<>();
    local.findings().forEach(item -> grounded.put(item.findingId(), item));
    List<LudongPocAiReviewFinding> findings = new ArrayList<>();
    if (result.path("findings").isArray()) {
      result.path("findings").forEach(item -> {
        LudongPocAiReviewFinding source = grounded.get(item.path("findingId").asText());
        if (source != null) {
          findings.add(new LudongPocAiReviewFinding(
              source.findingId(), safeLevel(item.path("level").asText()),
              valueOr(item.path("title").asText(), source.title()),
              valueOr(item.path("detail").asText(), source.detail()), source.evidence(),
              source.evidenceReferences()));
        }
      });
    }
    List<LudongPocAiReviewFinding> finalFindings = findings.isEmpty()
        ? local.findings() : List.copyOf(findings);
    return new LudongPocAiReviewResponse(
        local.runId(), "AI_MODEL", model, knowledgeBase.version(), OffsetDateTime.now(), profile.name(),
        valueOr(result.path("summary").asText(), local.summary()),
        valueOr(result.path("recommendation").asText(), local.recommendation()),
        Math.max(0, Math.min(100, result.path("confidence").asInt(local.confidence()))),
        focus, finalFindings, missing,
        valueOr(result.path("suggestedComment").asText(), local.suggestedComment()),
        local.accuracyNotice());
  }

  private static Map<String, NodeProfile> profiles() {
    Map<String, NodeProfile> result = new LinkedHashMap<>();
    result.put("argumentation_review", profile("购置必要性论证", "购置理由与业务目标", "参考品牌型号的合理性", "设备数量及技术参数", "附件 3 配置标准"));
    result.put("technical_leader_review", profile("技术负责人确认", "技术参数可执行性", "接口与兼容性", "安装实施条件", "验收指标"));
    result.put("compilation_participant_review", profile("参与编制人员确认", "表单字段完整性", "采购目标一致性", "技术与服务要求", "设备清单一致性"));
    result.put("mall_selection_participant_review", profile("网上商城选型参与人确认", "品牌型号", "供应商与商品链接", "商城价格", "选型参与记录"));
    result.put("it_review", profile("教育信息技术部审核", "信创产品范围", "软硬件生态适配", "网络与数据安全", "技术参数可验证性"));
    result.put("unit_review", profile("申报单位负责人审核", "项目必要性", "单位内部需求", "项目负责人责任", "申报材料完整性"));
    result.put("funding_review", profile("经费主管单位负责人审核", "经费来源", "预算归属", "支出必要性", "预算与明细一致性"));
    result.put("asset_configuration_review", profile("资产处配置审核", "配置价格上限", "配置数量上限", "现有资产情况", "附件 3 配置标准"));
    result.put("asset_division_leader_review", profile("资产处分管领导审核", "配置审核结果", "超限情况", "资产配置合理性"));
    result.put("asset_unit_leader_review", profile("资产处单位负责人审核", "资产审核意见完整性", "超标事项", "配置决策依据"));
    result.put("lab_equipment_review", profile("实验室管理处论证审核", "大型仪器认定", "设备共享方案", "安装使用条件", "预计使用效益"));
    result.put("lab_division_leader_review", profile("实验室管理处分管领导审核", "论证意见", "共享方案", "实验条件可行性"));
    result.put("lab_unit_leader_review", profile("实验室管理处单位负责人审核", "大型仪器审核结果", "资源共享", "单位审核责任"));
    result.put("school_leader_review", profile("分管校领导审核", "金额条件", "购置必要性", "预算安排", "前序审批意见"));
    result.put("finance_budget_review", profile("财务预算办公室审核", "年度预算安排", "预算追加手续", "经费项目归属", "预算金额一致性"));
    result.put("procurement_budget_review", profile("采购预算办公室审核", "采购预算安排", "预算金额", "采购品目", "预算依据"));
    result.put("handover_submit", profile("申请材料提交确认", "两份原始表格", "设备明细", "审批签字", "附件齐套性"));
    result.put("handover_accept", profile("申请材料受理确认", "材料齐套性", "表格一致性", "审批记录", "受理条件"));
    result.put("procurement_method_review", profile("财经处采购方式审核", "采购预算金额", "采购品目特征", "市场竞争情况", "现行采购制度"));
    result.put("finance_responsible_review", profile("财经处负责人终审", "全流程审批完整性", "意见一致性", "采购方式", "归档条件"));
    return Map.copyOf(result);
  }

  private static NodeProfile profile(String name, String... focus) {
    return new NodeProfile(name, List.of(focus));
  }

  private List<LudongPocAiReviewFinding> groundFindings(
      LudongPocApplicationResponse application,
      Map<String, Object> form,
      Map<String, Object> current,
      String nodeId,
      List<LudongPocPriorApprovalEvidence> priorApprovals,
      List<LudongPocAiReviewFinding> findings) {
    Map<String, Object> fields = new LinkedHashMap<>(form);
    fields.putAll(current);
    List<LudongPocAiEvidenceReference> priorReferences = priorApprovals.stream()
        .map(this::priorReference)
        .toList();
    return findings.stream().map(finding -> {
      List<LudongPocAiEvidenceReference> references = new ArrayList<>();
      references.addAll(fieldReferences(application, fields, finding));
      references.addAll(ruleReferences(nodeId, finding));
      references.addAll(priorReferences);
      return new LudongPocAiReviewFinding(
          finding.findingId(), finding.level(), finding.title(), finding.detail(),
          finding.evidence(), List.copyOf(references));
    }).toList();
  }

  private List<LudongPocAiEvidenceReference> fieldReferences(
      LudongPocApplicationResponse application,
      Map<String, Object> fields,
      LudongPocAiReviewFinding finding) {
    String clue = finding.title() + " " + finding.evidence();
    List<LudongPocAiEvidenceReference> result = new ArrayList<>();
    if (clue.contains("预算") || clue.contains("经费") || clue.contains("采购方式")) {
      result.add(field("budgetAmount", "预算金额", money(application.budgetAmount()), "项目申报表"));
      result.add(field("fundingSource", "经费来源", fallback(fields.get("fundingSource")), "项目申报表"));
    }
    if (clue.contains("设备") || clue.contains("品牌") || clue.contains("商城")
        || clue.contains("配置") || clue.contains("参数")) {
      result.add(field("items", "拟采购设备清单",
          application.items() == null ? "0 项" : application.items().size() + " 项",
          clue.contains("商城") ? "网上商城型号确认单" : "采购设备配置明细"));
    }
    if (clue.contains("负责人") || clue.contains("责任")) {
      result.add(field("projectLeaderName", "项目负责人",
          fallback(fields.get("projectLeaderName")), "项目申报表"));
      result.add(field("technicalLeaderName", "技术负责人",
          fallback(fields.get("technicalLeaderName")), "项目申报表"));
    }
    if (clue.contains("信创")) {
      result.add(field("requiresItReview", "涉及信创产品",
          fallback(fields.get("requiresItReview")), "流程判定信息"));
    }
    if (clue.contains("校领导") || clue.contains("金额条件")) {
      result.add(field("applicantUnitType", "申报单位类型",
          fallback(fields.get("applicantUnitType")), "流程判定信息"));
      result.add(field("requiresSchoolLeader", "校领导审批判定",
          fallback(fields.get("requiresSchoolLeader")), "流程判定信息"));
    }
    if (clue.contains("材料") || clue.contains("归档")) {
      result.add(field("applicationNo", "申报编号", application.applicationNo(), "申报材料包"));
    }
    if (clue.contains("论证")) {
      result.add(field("purchaseReason", "购置理由及必要性论证",
          fallback(fields.get("purchaseReason")), "购置必要性论证表单"));
    }
    if (result.isEmpty()) {
      result.add(field("projectName", "采购项目名称", application.projectName(), "项目申报表"));
      result.add(field("applicantUnit", "申报单位", application.applicantUnit(), "项目申报表"));
    }
    return result;
  }

  private List<LudongPocAiEvidenceReference> ruleReferences(
      String nodeId, LudongPocAiReviewFinding finding) {
    String clue = finding.title() + " " + finding.evidence();
    List<String> ruleIds = new ArrayList<>();
    if (clue.contains("预算与") || clue.contains("明细合计")) ruleIds.add("LDU-BUDGET-001");
    if (clue.contains("商城")) {
      ruleIds.add("LDU-MALL-001");
      ruleIds.add("LDU-MALL-002");
    }
    if (clue.contains("附件 3") || clue.contains("附件3") || clue.contains("配置标准")) {
      ruleIds.add("LDU-ASSET-ANNEX3-001");
    }
    if (clue.contains("设备") || clue.contains("参数")) ruleIds.add("LDU-FORM-ITEM-001");
    if (clue.contains("校领导")) {
      ruleIds.add("LDU-LEADER-001");
      ruleIds.add("LDU-LEADER-002");
    }
    if ("finance_budget_review".equals(nodeId)) ruleIds.add("LDU-BUDGET-STATUS-001");
    if ("procurement_budget_review".equals(nodeId)) ruleIds.add("LDU-PROCUREMENT-BUDGET-001");
    if (nodeId.startsWith("handover") || "finance_responsible_review".equals(nodeId)) {
      ruleIds.add("LDU-ARCHIVE-001");
    }
    if (ruleIds.isEmpty()) ruleIds.add("LDU-FORM-BASE-001");
    return ruleIds.stream().distinct().map(knowledgeBase::reference).toList();
  }

  private LudongPocAiEvidenceReference priorReference(LudongPocPriorApprovalEvidence approval) {
    String decision = "approve".equals(approval.decision()) ? "通过" : "驳回";
    String summary = approval.comment() == null || approval.comment().isBlank()
        ? decision : decision + "；意见：" + approval.comment().trim();
    return new LudongPocAiEvidenceReference(
        "prior:" + approval.nodeId() + ":" + approval.reviewedAt(), "PRIOR_APPROVAL",
        approval.nodeId() + "审批", summary,
        "办理人 " + approval.reviewerId() + " / " + approval.reviewedAt(), "SYSTEM_RECORDED");
  }

  private static LudongPocAiEvidenceReference field(
      String id, String label, String value, String source) {
    return new LudongPocAiEvidenceReference(
        "field:" + id, "FIELD", label, value, source, "SYSTEM_SNAPSHOT");
  }

  private static LudongPocAiReviewFinding finding(
      String level, String title, String detail, String evidence) {
    return new LudongPocAiReviewFinding(
        "finding-" + Integer.toUnsignedString((title + "|" + evidence).hashCode(), 36),
        level, title, detail, evidence, List.of());
  }

  private static void required(List<String> missing, Object value, String label) {
    if (blank(value)) {
      missing.add(label);
    }
  }

  private static boolean blank(Object value) {
    return text(value).isBlank();
  }

  private static String text(Object value) {
    return value == null ? "" : String.valueOf(value).trim();
  }

  private static String fallback(Object value) {
    String text = text(value);
    return text.isBlank() ? "未填写" : text;
  }

  private static BigDecimal number(Object value) {
    try {
      return value == null || String.valueOf(value).isBlank()
          ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value));
    } catch (NumberFormatException ignored) {
      return BigDecimal.ZERO;
    }
  }

  private static int participantCount(Object value) {
    String raw = text(value);
    if (raw.isBlank()) return 0;
    return (int) List.of(raw.split("[,，、;；\\s]+")).stream()
        .map(String::trim).filter(item -> !item.isBlank()).distinct().count();
  }

  private static String money(BigDecimal value) {
    BigDecimal safe = value == null ? BigDecimal.ZERO : value;
    return "¥" + safe.setScale(0, RoundingMode.HALF_UP).toPlainString();
  }

  private static String normalizeNodeId(String nodeId) {
    String value = nodeId == null ? "" : nodeId.trim();
    return value.startsWith("task_") ? value.substring(5) : value;
  }

  private static String valueOr(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }

  private static String safeLevel(String value) {
    return List.of("passed", "warning", "risk").contains(value) ? value : "warning";
  }

  private static List<String> readStrings(JsonNode node, List<String> fallback) {
    if (!node.isArray()) {
      return fallback;
    }
    List<String> result = new ArrayList<>();
    node.forEach(item -> {
      if (!item.asText().isBlank()) {
        result.add(item.asText());
      }
    });
    return result.isEmpty() ? fallback : List.copyOf(result);
  }

  private record NodeProfile(String name, List<String> focus) {
  }
}
