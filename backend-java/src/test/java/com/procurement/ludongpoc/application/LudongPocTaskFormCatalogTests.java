package com.procurement.ludongpoc.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import org.junit.jupiter.api.Test;

class LudongPocTaskFormCatalogTests {

  @Test
  void validatesNewParticipantApprovalForms() {
    assertThat(LudongPocTaskFormCatalog.validate(
        "technical_leader_review", "approve", Map.of("technicalLeaderOpinion", "同意")))
        .containsEntry("technicalLeaderOpinion", "同意");
    assertThat(LudongPocTaskFormCatalog.validate(
        "compilation_participant_review", "approve", Map.of("compilationParticipantOpinion", "同意")))
        .containsEntry("compilationParticipantOpinion", "同意");
    assertThat(LudongPocTaskFormCatalog.validate(
        "mall_selection_participant_review", "approve", Map.of(
            "mallSelectionParticipantOpinion", "同意")))
        .containsEntry("mallSelectionParticipantOpinion", "同意");
  }

  @Test
  void rejectsApprovalWhenParticipantConfirmationIsMissing() {
    assertThatThrownBy(() -> LudongPocTaskFormCatalog.validate(
        "mall_selection_participant_review", "approve", Map.of()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("审批通过前必须完成节点字段");
  }

  @Test
  void keepsArgumentationAsReviewerOpinionOnly() {
    assertThat(LudongPocTaskFormCatalog.validate(
        "argumentation_review", "approve", Map.of(
            "argumentationOpinion", "同意",
            "argumentationComment", "必要性论证充分")))
        .containsOnlyKeys("argumentationOpinion", "argumentationComment");
  }

  @Test
  void onlyAllowsRejectWhenArgumentationConclusionIsDifferent() {
    assertThatThrownBy(() -> LudongPocTaskFormCatalog.validate(
        "argumentation_review", "approve", Map.of(
            "argumentationOpinion", "不同意",
            "argumentationComment", "建议重新论证")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("只能驳回");
  }

  @Test
  void generatesTargetNodeFormForEmployeeNumberReuse() {
    Map<String, Object> reused = LudongPocTaskFormCatalog.reusedApprovalData(
        "funding_review",
        "task_unit_review",
        Map.of(
            "applicantUnitOpinion", "同意",
            "applicantUnitComment", "申报单位已核验"));

    assertThat(reused)
        .containsEntry("fundingUnitOpinion", "同意")
        .containsEntry("fundingUnitComment", "同工号审批结论自动复用，来源节点：unit_review");
  }

  @Test
  void mapsEquivalentBudgetChoiceWithoutInventingAnotherSelection() {
    Map<String, Object> reused = LudongPocTaskFormCatalog.reusedApprovalData(
        "procurement_budget_review",
        "finance_budget_review",
        Map.of(
            "financeBudgetStatus", "本项目年初无预算，现已办理预算追加手续",
            "financeBudgetOpinion", "资金来源已核验"));

    assertThat(reused)
        .containsEntry(
            "procurementBudgetStatus", "本项目年初无预算，现已办理预算追加手续")
        .containsEntry(
            "procurementBudgetOpinion", "同工号审批结论自动复用，来源节点：finance_budget_review");
  }
}
