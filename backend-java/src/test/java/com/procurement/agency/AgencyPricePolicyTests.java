package com.procurement.agency;

import static org.junit.jupiter.api.Assertions.*;

import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyEvaluationRecords.Criterion;
import com.procurement.agency.domain.AgencyPriceRecords.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyPricePolicyTests {
  Rule rule(String source, String formula, String max, int scale, String rounding) {
    return new Rule(
        source,
        formula,
        formula.equals("minimum_ratio") ? "P1" : "",
        new BigDecimal(max),
        scale,
        rounding,
        "按定稿同价处理，不自动排序");
  }

  Line line(String id, String price) {
    return new Line(
        id, id, "source-" + id, "hash", "original", new BigDecimal(price), "CNY", null, null);
  }

  Criterion criterion(String weight) {
    return new Criterion(
        "P1",
        "价格项",
        "commercial",
        "所有对象",
        "score",
        BigDecimal.ZERO,
        new BigDecimal("100"),
        new BigDecimal(weight),
        "weighted_normalized",
        true,
        2,
        "HALF_UP");
  }

  @Test
  void multipliesExactlyAndRoundsOnlyTheFinalDivision() {
    var trace =
        AgencyPricePolicy.calculate(
            rule("original", "minimum_ratio", "30", 2, "HALF_UP"),
            List.of(line("a", "1.00"), line("b", "3.00")));
    assertEquals(new BigDecimal("30.00"), trace.lines().get(1).numerator());
    assertEquals(new BigDecimal("10.00"), trace.lines().get(1).score());
    assertEquals(new BigDecimal("30.00"), trace.lines().getFirst().score());
  }

  @Test
  void repeatingDecimalsAndExplicitRoundingModesAreReproducible() {
    var sources = List.of(line("a", "1.00"), line("b", "8.00"));
    assertEquals(
        "0.13",
        AgencyPricePolicy.calculate(rule("original", "minimum_ratio", "1", 2, "HALF_UP"), sources)
            .lines()
            .get(1)
            .score()
            .toPlainString());
    assertEquals(
        "0.12",
        AgencyPricePolicy.calculate(rule("original", "minimum_ratio", "1", 2, "HALF_EVEN"), sources)
            .lines()
            .get(1)
            .score()
            .toPlainString());
    assertEquals(
        "0.12",
        AgencyPricePolicy.calculate(rule("original", "minimum_ratio", "1", 2, "DOWN"), sources)
            .lines()
            .get(1)
            .score()
            .toPlainString());
  }

  @Test
  void intermediateRatioMustNotBeRoundedBeforeMultiplication() {
    var trace =
        AgencyPricePolicy.calculate(
            rule("original", "minimum_ratio", "30", 2, "HALF_UP"),
            List.of(line("a", "1"), line("b", "6")));
    assertEquals("5.00", trace.lines().get(1).score().toPlainString());
  }

  @Test
  void hugeAndClosePricesStayExact() {
    var trace =
        AgencyPricePolicy.calculate(
            rule("original", "minimum_ratio", "30", 6, "HALF_UP"),
            List.of(line("a", "999999999999999999.98"), line("b", "999999999999999999.99")));
    assertEquals("999999999999999999.98", trace.minimum().toPlainString());
    assertEquals("30.000000", trace.lines().get(1).score().toPlainString());
  }

  @Test
  void comparisonAllowsZeroWithoutGeneratingScoresOrReorderingSubjects() {
    var trace =
        AgencyPricePolicy.calculate(
            rule("corrected", "price_comparison", "0", 2, "HALF_UP"),
            List.of(line("b", "20"), line("a", "0.00")));
    assertEquals("b", trace.lines().getFirst().participationId());
    assertEquals("0.00", trace.minimum().toPlainString());
    assertTrue(trace.lines().stream().allMatch(l -> l.score() == null && l.numerator() == null));
  }

  @Test
  void zeroDivisorMissingNegativeAndMixedCurrencyPricesAreBlocked() {
    var r = rule("policy", "minimum_ratio", "30", 2, "HALF_UP");
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyPricePolicy.calculate(r, List.of(line("a", "0"))));
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyPricePolicy.calculate(r, List.of(line("a", "-1"))));
    assertThrows(IllegalArgumentException.class, () -> AgencyPricePolicy.calculate(r, List.of()));
    var usd = new Line("b", "b", "s", "h", "original", new BigDecimal("2"), "USD", null, null);
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyPricePolicy.calculate(r, List.of(line("a", "1"), usd)));
  }

  @Test
  void rejectsScriptsAndUnspecifiedTieOrPrecisionRules() {
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyPricePolicy.validate(rule("original", "eval(1)", "30", 2, "HALF_UP")));
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyPricePolicy.validate(rule("original", "minimum_ratio", "30", 7, "HALF_UP")));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyPricePolicy.validate(
                new Rule(
                    "original", "minimum_ratio", "P1", new BigDecimal("30"), 2, "HALF_UP", "")));
  }

  @Test
  void sourceMustMatchProcurementMethodAndSingleSourceHasNoCompetitiveComparison() {
    assertTrue(
        AgencyPricePolicy.blockers(
                    rule("original", "minimum_ratio", "30", 2, "HALF_UP"),
                    "竞争性磋商",
                    "comprehensive",
                    List.of(criterion("30")))
                .size()
            > 0);
    assertTrue(
        AgencyPricePolicy.blockers(
                rule("final_original", "minimum_ratio", "30", 2, "HALF_UP"),
                "竞争性磋商",
                "comprehensive",
                List.of(criterion("30")))
            .isEmpty());
    assertFalse(
        AgencyPricePolicy.blockers(
                rule("original", "price_comparison", "0", 2, "HALF_UP"),
                "单一来源",
                "consultation",
                List.of())
            .isEmpty());
    assertFalse(
        AgencyPricePolicy.blockers(
                rule("final_original", "price_comparison", "0", 2, "HALF_UP"),
                "询价",
                "price_comparison",
                List.of())
            .isEmpty());
    assertTrue(
        AgencyPricePolicy.blockers(
                rule("final_original", "price_comparison", "0", 2, "HALF_UP"),
                "竞争性谈判",
                "negotiation_price",
                List.of())
            .isEmpty());
  }

  @Test
  void priceWeightCannotBeAddedOnTopOfFrozenTotalOrAttachedToTechnicalCriterion() {
    assertFalse(
        AgencyPricePolicy.blockers(
                rule("final_original", "minimum_ratio", "31", 2, "HALF_UP"),
                "竞争性磋商",
                "comprehensive",
                List.of(criterion("30")))
            .isEmpty());
    assertFalse(
        AgencyPricePolicy.blockers(
                rule("final_original", "minimum_ratio", "30", 2, "HALF_UP"),
                "竞争性磋商",
                "comprehensive",
                List.of())
            .isEmpty());
    assertFalse(
        AgencyPricePolicy.blockers(
                rule("original", "minimum_ratio", "30", 2, "HALF_UP"),
                "公开招标",
                "lowest_price",
                List.of(criterion("30")))
            .isEmpty());
  }

  @Test
  void originalAndConfiguredValuesAreComparedWithoutFalseDecimalScaleDifferences() {
    var a = rule("original", "minimum_ratio", "30.0", 2, "HALF_UP");
    assertTrue(
        AgencyPricePolicy.differences(a, rule("original", "minimum_ratio", "30.00", 2, "HALF_UP"))
            .isEmpty());
    assertEquals(
        List.of("保留位数", "舍入方式"),
        AgencyPricePolicy.differences(a, rule("original", "minimum_ratio", "30", 3, "DOWN")));
  }
}
