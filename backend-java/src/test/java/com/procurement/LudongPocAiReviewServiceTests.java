package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.ludongpoc.api.LudongPocAiReviewResponse;
import com.procurement.ludongpoc.api.LudongPocApplicationResponse;
import com.procurement.ludongpoc.application.LudongPocAiReviewService;
import com.procurement.ludongpoc.application.LudongPocAiKnowledgeBase;
import com.procurement.ludongpoc.application.LudongPocAiEvaluationService;
import com.procurement.ludongpoc.api.LudongPocPriorApprovalEvidence;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LudongPocAiReviewServiceTests {

  private final ObjectMapper objectMapper = new ObjectMapper();
  private final LudongPocAiReviewService service = new LudongPocAiReviewService(
      objectMapper, new LudongPocAiKnowledgeBase(objectMapper), "", "", "test-model");

  @Test
  void argumentationReviewUsesCurrentNodeFocusAndFindsMissingArgumentationEvidence() {
    LudongPocAiReviewResponse result = service.review(
        application(Map.of(
            "fundingSource", "年度教学经费",
            "projectLeaderName", "王老师",
            "technicalLeaderName", "赵老师")),
        "task_argumentation_review",
        Map.of("argumentationOpinion", "同意"));

    assertThat(result.analysisMode()).isEqualTo("RULE_ASSISTED");
    assertThat(result.nodeName()).isEqualTo("购置必要性论证");
    assertThat(result.reviewFocus()).contains("购置理由与业务目标", "学校采购管理办法");
    assertThat(result.missingMaterials()).contains("购置理由及必要性论证");
    assertThat(result.findings()).anyMatch(item -> item.title().contains("必要性论证"));
    assertThat(result.findings()).allSatisfy(item -> {
      assertThat(item.findingId()).isNotBlank();
      assertThat(item.evidenceReferences()).anyMatch(ref -> "FIELD".equals(ref.type()));
      assertThat(item.evidenceReferences()).anyMatch(ref -> "RULE".equals(ref.type()));
    });
    assertThat(result.knowledgeVersion()).startsWith("ldu-procurement-policy-v3");
    assertThat(result.institutionalBasis()).isEqualTo("鲁东大学校内采购制度知识库");
    assertThat(result.evidenceBoundary())
        .contains("不使用互联网搜索", "第三方", "人工核验");
    assertThat(result.institutionalDocuments())
        .anyMatch(document -> document.contains("鲁东大学采购管理办法"));
    assertThat(result.findings()).flatExtracting(item -> item.evidenceReferences())
        .filteredOn(reference -> "RULE".equals(reference.type()))
        .allSatisfy(reference -> {
          assertThat(reference.source()).startsWith("鲁东大学");
          assertThat(reference.source()).doesNotContain("http://", "https://", "第三方");
        });
    assertThat(result.recommendation()).isEqualTo("建议重点复核");
  }

  @Test
  void mallSelectionDetectsOverPriceAndInsufficientParticipants() {
    LudongPocApplicationResponse application = application(Map.of(
        "fundingSource", "年度教学经费",
        "projectLeaderName", "王老师",
        "technicalLeaderName", "赵老师",
        "mallSelectionApplicable", "是"));
    Map<String, Object> item = new java.util.LinkedHashMap<>(application.items().getFirst());
    item.put("selectedBrand", "品牌甲");
    item.put("selectedModel", "A1");
    item.put("selectedSupplier", "供应商甲");
    item.put("selectedUnitPrice", "110000");
    item.put("selectionParticipants", "张三、李四");
    LudongPocApplicationResponse changed = new LudongPocApplicationResponse(
        application.id(), application.applicationNo(), application.projectName(),
        application.applicantUnit(), application.departmentId(), application.budgetAmount(),
        application.status(), application.formData(), List.of(item), application.createdBy(),
        application.submittedAt(), application.approvedAt(), application.archivedAt(),
        application.createdAt(), application.updatedAt());

    LudongPocAiReviewResponse result = service.reviewRulesOnly(
        changed, "mall_selection_participant_review", Map.of(), List.of());

    assertThat(result.findings()).anyMatch(itemFinding ->
        "risk".equals(itemFinding.level()) && itemFinding.title().contains("超过申报单价"));
    assertThat(result.findings()).anyMatch(itemFinding ->
        "risk".equals(itemFinding.level()) && itemFinding.title().contains("参与人数不足"));
  }

  @Test
  void findingsIncludePriorApprovalEvidenceWhenHistoryExists() {
    LudongPocAiReviewResponse result = service.reviewRulesOnly(
        application(Map.of(
            "fundingSource", "年度教学经费",
            "projectLeaderName", "王老师",
            "technicalLeaderName", "赵老师")),
        "unit_review",
        Map.of(),
        List.of(new LudongPocPriorApprovalEvidence(
            "argumentation_review", "reviewer-001", "approve",
            Map.of("argumentationOpinion", "同意"), "论证通过",
            OffsetDateTime.parse("2026-08-29T11:00:00+08:00"))));

    assertThat(result.findings()).allSatisfy(finding ->
        assertThat(finding.evidenceReferences()).anyMatch(reference ->
            "PRIOR_APPROVAL".equals(reference.type())
                && reference.value().contains("论证通过")));
  }

  @Test
  void fixedEvaluationDatasetReportsRecallAndFalsePositives() {
    LudongPocAiEvaluationService.EvaluationResult evaluation =
        new LudongPocAiEvaluationService(objectMapper, service).evaluate();

    assertThat(evaluation.sampleCount()).isEqualTo(4);
    assertThat(evaluation.expectedRiskCount()).isEqualTo(3);
    assertThat(evaluation.riskRecall()).isEqualTo(1.0);
    assertThat(evaluation.falsePositiveCount()).isZero();
  }

  @Test
  void budgetReviewRaisesRiskWhenFundingEvidenceIsMissing() {
    LudongPocAiReviewResponse result = service.review(
        application(Map.of(
            "fundingSource", "",
            "projectLeaderName", "王老师",
            "technicalLeaderName", "赵老师")),
        "finance_budget_review",
        Map.of());

    assertThat(result.nodeName()).isEqualTo("财务预算办公室审核");
    assertThat(result.recommendation()).isEqualTo("建议补充材料后审批");
    assertThat(result.findings()).anyMatch(item ->
        "risk".equals(item.level()) && item.title().contains("预算依据"));
    assertThat(result.suggestedComment()).contains("补充完善");
  }

  @Test
  void mallSelectionReviewShowsItsSpecificEvidenceAndMissingConfirmation() {
    LudongPocAiReviewResponse result = service.review(
        application(Map.of(
            "fundingSource", "年度教学经费",
            "projectLeaderName", "王老师",
            "technicalLeaderName", "赵老师",
            "mallSelectionApplicable", "是")),
        "mall_selection_participant_review",
        Map.of());

    assertThat(result.nodeName()).isEqualTo("网上商城选型参与人确认");
    assertThat(result.reviewFocus()).contains("品牌型号", "商城价格", "选型参与记录");
    assertThat(result.missingMaterials()).contains("网上商城型号确认单");
    assertThat(result.findings()).anyMatch(item ->
        "risk".equals(item.level()) && item.evidence().contains("商城型号确认单"));
  }

  private static LudongPocApplicationResponse application(Map<String, Object> formData) {
    OffsetDateTime now = OffsetDateTime.parse("2026-08-29T10:00:00+08:00");
    return new LudongPocApplicationResponse(
        "ldu-ai-review-test", "LDUG-20260829-AI001", "智慧教学服务器采购项目",
        "计算机与人工智能学院", "dept-cs", new BigDecimal("200000"), "in_approval",
        formData,
        List.of(Map.of(
            "name", "智慧教学服务器",
            "quantity", "2",
            "unitPrice", "100000",
            "totalPrice", "200000",
            "technicalParameters", "国产处理器、64GB 内存",
            "referenceBrands", "品牌甲、品牌乙")),
        "applicant", now, null, null, now, now);
  }
}
