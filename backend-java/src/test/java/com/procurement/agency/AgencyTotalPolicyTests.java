package com.procurement.agency;

import static org.junit.jupiter.api.Assertions.*;

import com.procurement.agency.application.AgencyTotalPolicy;
import com.procurement.agency.domain.AgencyEvaluationRecords.Criterion;
import com.procurement.agency.domain.AgencyPriceRecords;
import com.procurement.agency.domain.AgencyTotalRecords.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyTotalPolicyTests {
  Criterion criterion(String key, String max, String weight, int scale, String round) {
    return new Criterion(
        key,
        key,
        key.equals("P1") ? "commercial" : "technical",
        "所有对象",
        "score",
        BigDecimal.ZERO,
        new BigDecimal(max),
        new BigDecimal(weight),
        "weighted_normalized",
        true,
        scale,
        round);
  }

  Rule rule(int scale, String rounding) {
    return new Rule(
        "mean_raw_then_weight",
        scale,
        rounding,
        "manual_pending",
        List.of(new Source("T1", "member_mean"), new Source("P1", "objective_price")));
  }

  AgencyPriceRecords.Rule price() {
    return new AgencyPriceRecords.Rule(
        "final_original", "minimum_ratio", "P1", new BigDecimal("30"), 2, "HALF_UP", "同分按原文另行处理");
  }

  AgencyTotalPolicy.Sample sample(String user, String score) {
    return new AgencyTotalPolicy.Sample(
        user, "sheet-" + user, "hash-" + user, score == null ? null : new BigDecimal(score));
  }

  @Test
  void allFrozenMembersAreAveragedBeforeWeightingWithoutEarlyRounding() {
    var component =
        AgencyTotalPolicy.member(
            criterion("T1", "10", "70", 2, "HALF_UP"),
            Set.of("a", "b"),
            List.of(sample("a", "8"), sample("b", "6")));
    assertEquals("14", component.rawSum().toPlainString());
    assertEquals("980", component.numerator().toPlainString());
    assertEquals("20", component.denominator().toPlainString());
    assertEquals("49.00", component.value().toPlainString());
    assertEquals(2, component.memberCount());
  }

  @Test
  void intermediateAverageDoesNotGetRounded() {
    var component =
        AgencyTotalPolicy.member(
            criterion("T1", "3", "70", 2, "HALF_UP"),
            Set.of("a", "b"),
            List.of(sample("a", "0"), sample("b", "1")));
    assertEquals("11.67", component.value().toPlainString());
  }

  @Test
  void onePriceComponentIgnoresPersonalPriceScoresAndIsAddedOnlyOnce() {
    var line =
        new AgencyPriceRecords.Line(
            "s",
            "甲",
            "receipt",
            "hash",
            "final_original",
            new BigDecimal("100"),
            "CNY",
            new BigDecimal("3000"),
            new BigDecimal("30.00"));
    var technical =
        AgencyTotalPolicy.member(
            criterion("T1", "10", "70", 2, "HALF_UP"),
            Set.of("a", "b"),
            List.of(sample("a", "8"), sample("b", "6")));
    var p =
        AgencyTotalPolicy.objective(
            criterion("P1", "100", "30", 2, "HALF_UP"), price(), line, "calc", "fp");
    assertEquals(0, p.memberCount());
    assertNull(p.rawSum());
    assertEquals("calc", p.references().getFirst().id());
    assertEquals(
        "79.00",
        AgencyTotalPolicy.total(rule(2, "HALF_UP"), "s", "甲", List.of(technical, p))
            .total()
            .toPlainString());
  }

  @Test
  void duplicateMissingOrSelectiveMembersCannotProduceAComponent() {
    var c = criterion("T1", "10", "70", 2, "HALF_UP");
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyTotalPolicy.member(c, Set.of("a", "b"), List.of(sample("a", "8"))));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyTotalPolicy.member(
                c, Set.of("a", "b"), List.of(sample("a", "8"), sample("a", "6"))));
    assertThrows(
        IllegalArgumentException.class, () -> AgencyTotalPolicy.member(c, Set.of(), List.of()));
  }

  @Test
  void missingNegativeOrOutOfRangeScoresAreNotFilledOrClamped() {
    var c = criterion("T1", "10", "70", 2, "HALF_UP");
    for (String score : Arrays.asList(null, "-1", "11", "1.0000001"))
      assertThrows(
          IllegalArgumentException.class,
          () -> AgencyTotalPolicy.member(c, Set.of("a"), List.of(sample("a", score))));
  }

  @Test
  void arbitraryFormulaAndAutomaticTieBreakingAreRejected() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyTotalPolicy.validate(
                new Rule(
                    "drop_high_low",
                    2,
                    "HALF_UP",
                    "manual_pending",
                    rule(2, "HALF_UP").sources())));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyTotalPolicy.validate(
                new Rule(
                    "mean_raw_then_weight",
                    2,
                    "HALF_UP",
                    "supplier_id",
                    rule(2, "HALF_UP").sources())));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyTotalPolicy.validate(
                new Rule(
                    "mean_raw_then_weight",
                    2,
                    "HALF_UP",
                    "manual_pending",
                    List.of(
                        new Source("P1", "member_mean"), new Source("P1", "objective_price")))));
  }

  @Test
  void missingOrDoubleCountedPriceSourceAndNonScoringMethodsAreBlocked() {
    var criteria =
        List.of(
            criterion("T1", "10", "70", 2, "HALF_UP"), criterion("P1", "100", "30", 2, "HALF_UP"));
    assertTrue(
        AgencyTotalPolicy.blockers(rule(2, "HALF_UP"), "comprehensive", criteria, price())
            .isEmpty());
    var invalid =
        new Rule(
            "mean_raw_then_weight",
            2,
            "HALF_UP",
            "manual_pending",
            List.of(new Source("T1", "member_mean"), new Source("P1", "member_mean")));
    assertFalse(AgencyTotalPolicy.blockers(invalid, "comprehensive", criteria, price()).isEmpty());
    assertFalse(
        AgencyTotalPolicy.blockers(rule(2, "HALF_UP"), "negotiation_price", criteria, price())
            .isEmpty());
    assertFalse(
        AgencyTotalPolicy.blockers(
                rule(2, "HALF_UP"), "comprehensive", criteria.subList(0, 1), price())
            .isEmpty());
  }

  @Test
  void totalRoundingIsExplicitAndDoesNotMutateComponentValues() {
    var c =
        AgencyTotalPolicy.member(
            criterion("T1", "10", "70", 3, "HALF_UP"), Set.of("a"), List.of(sample("a", "1.235")));
    var t = AgencyTotalPolicy.total(rule(2, "DOWN"), "s", "甲", List.of(c));
    assertEquals("8.645", t.componentSum().toPlainString());
    assertEquals("8.64", t.total().toPlainString());
    assertEquals("8.645", t.components().getFirst().value().toPlainString());
  }

  @Test
  void fullScoreRoundingThatWouldExceedOneHundredIsBlocked() {
    var criteria =
        List.of(
            criterion("T1", "10", "69.665", 2, "HALF_UP"),
            criterion("P1", "100", "30.335", 2, "HALF_UP"));
    var p =
        new AgencyPriceRecords.Rule(
            "final_original",
            "minimum_ratio",
            "P1",
            new BigDecimal("30.335"),
            2,
            "HALF_UP",
            "basis");
    assertTrue(
        AgencyTotalPolicy.blockers(rule(2, "HALF_UP"), "comprehensive", criteria, p).stream()
            .anyMatch(s -> s.contains("满分不等于100")));
  }

  @Test
  void equalFinalTotalsAreMarkedWithoutReorderingOrChoosingAWinner() {
    var a = new SubjectTotal("b", "乙", List.of(), new BigDecimal("80"), new BigDecimal("80.00"));
    var b = new SubjectTotal("a", "甲", List.of(), new BigDecimal("80"), new BigDecimal("80.0"));
    var ties = AgencyTotalPolicy.ties(List.of(a, b));
    assertEquals(1, ties.size());
    assertEquals(List.of("b", "a"), ties.getFirst().participationIds());
  }

  @Test
  void originalMappingOrderIsNotMistakenForAChangedRule() {
    var a = rule(2, "HALF_UP");
    var b =
        new Rule(
            a.method(),
            a.totalScale(),
            a.totalRounding(),
            a.tieHandling(),
            List.of(a.sources().get(1), a.sources().get(0)));
    assertTrue(AgencyTotalPolicy.differences(a, b).isEmpty());
    assertEquals(List.of("总分舍入方式"), AgencyTotalPolicy.differences(a, rule(2, "DOWN")));
  }
}
