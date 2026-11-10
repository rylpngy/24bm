package com.procurement.agency;

import static org.junit.jupiter.api.Assertions.*;

import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyAssessmentRecords.*;
import com.procurement.agency.domain.AgencyEvaluationRecords.Criterion;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyMethodBranchTests {
  @Test
  void openAndInvitedBiddingSupportBothDocumentMethodsButNoFinalNegotiation() {
    for (var method : List.of("公开招标", "邀请招标"))
      for (var evaluation : List.of("comprehensive", "lowest_price")) {
        var b = AgencyMethodPolicy.branch(method, evaluation);
        assertFalse(b.finalResponseRequired());
        assertTrue(b.competitive());
        assertThrows(
            IllegalStateException.class,
            () -> AgencyMethodPolicy.finalResponse(method, evaluation));
      }
  }

  @Test
  void negotiationUsesFinalPriceWithoutTechnicalBusinessScoring() {
    var b = AgencyMethodPolicy.branch("竞争性谈判", "negotiation_price");
    assertTrue(b.finalResponseRequired());
    assertFalse(b.scoringAllowed());
    assertEquals("final_original", b.priceSource());
    assertThrows(
        IllegalStateException.class, () -> AgencyMethodPolicy.branch("竞争性谈判", "comprehensive"));
  }

  @Test
  void consultationUsesFinalResponseAndOriginalComprehensiveRules() {
    var b = AgencyMethodPolicy.branch("竞争性磋商", "comprehensive");
    assertTrue(b.finalResponseRequired());
    assertTrue(b.scoringAllowed());
    assertThrows(
        IllegalStateException.class, () -> AgencyMethodPolicy.branch("竞争性磋商", "negotiation_price"));
  }

  @Test
  void inquiryDoesNotOpenRepeatedBiddingOrComprehensiveScores() {
    var b = AgencyMethodPolicy.branch("询价", "price_comparison");
    assertFalse(b.scoringAllowed());
    assertFalse(b.finalResponseRequired());
    assertThrows(
        IllegalStateException.class, () -> AgencyMethodPolicy.branch("询价", "comprehensive"));
    assertThrows(
        IllegalStateException.class,
        () -> AgencyMethodPolicy.finalResponse("询价", "price_comparison"));
  }

  @Test
  void soleSourceIsProfessionalConsultationWithoutCompetitiveRanking() {
    var b = AgencyMethodPolicy.branch("单一来源", "consultation");
    assertFalse(b.competitive());
    assertFalse(b.scoringAllowed());
    assertFalse(b.finalResponseRequired());
    assertEquals("negotiated_record", b.priceSource());
  }

  @Test
  void unsupportedOrCrossMethodBranchesFailClosed() {
    for (var method : List.of("公开招标", "邀请招标", "竞争性谈判", "竞争性磋商", "询价", "单一来源", "unknown"))
      for (var evaluation : AgencyEvaluationRules.METHODS)
        if (!AgencyMethodPolicy.permitted(method).contains(evaluation))
          assertThrows(
              IllegalStateException.class, () -> AgencyMethodPolicy.branch(method, evaluation));
  }

  Criterion rule() {
    return new Criterion(
        "__final:complete",
        "共同需求实质响应",
        "conformity",
        "全部",
        "pass_fail",
        BigDecimal.ZERO,
        BigDecimal.ZERO,
        BigDecimal.ZERO,
        "",
        true,
        0,
        "HALF_UP");
  }

  @Test
  void partialFinalFactsMayBeSavedButNeverSubmittedAsACompleteReview() {
    var entries = List.of(new Entry("a", "__final:complete", null, null, "", "尚在核对"));
    assertDoesNotThrow(
        () ->
            AgencyAssessmentPolicy.validate(
                List.of(new Subject("a", "甲")), List.of(rule()), entries, false));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyAssessmentPolicy.validate(
                List.of(new Subject("a", "甲")), List.of(rule()), entries, true));
  }

  @Test
  void finalReviewCannotFabricateScoresOrCrossSupplierCells() {
    for (var e :
        List.of(
            new Entry("a", "__final:complete", BigDecimal.ONE, "pass", "原文", "本人意见"),
            new Entry("foreign", "__final:complete", null, "pass", "原文", "本人意见")))
      assertThrows(
          IllegalArgumentException.class,
          () ->
              AgencyAssessmentPolicy.validate(
                  List.of(new Subject("a", "甲")), List.of(rule()), List.of(e), true));
  }
}
