package com.procurement.agency;

import static org.junit.jupiter.api.Assertions.*;

import com.procurement.agency.application.AgencyEvaluationRules;
import com.procurement.agency.domain.AgencyEvaluationRecords.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyEvaluationRulesTests {
  Criterion score(String key, String weight) {
    return new Criterion(
        key,
        "技术方案",
        "technical",
        "实质响应的供应商",
        "score",
        BigDecimal.ZERO,
        new BigDecimal("10"),
        new BigDecimal(weight),
        "weighted_normalized",
        true,
        2,
        "HALF_UP");
  }

  RulePair pair(Criterion a, Criterion b) {
    return new RulePair(a, b, "定稿第12页第1项", true);
  }

  Config config(List<RulePair> rules, String method) {
    return new Config(
        "第一轮",
        "revision",
        method,
        "V1",
        "合成规则依据",
        "测试室",
        OffsetDateTime.now(),
        List.of(new Member("u", List.of("organizer", "review_member"))),
        rules,
        "同分处理按定稿第12页人工复核");
  }

  @Test
  void exactDecimalWeightsWithoutBinaryRounding() {
    var c =
        config(
            List.of(
                pair(score("A", "33.333333"), score("A", "33.333333")),
                pair(score("B", "66.666667"), score("B", "66.666667"))),
            "comprehensive");
    AgencyEvaluationRules.validate(c);
    assertTrue(AgencyEvaluationRules.blockers(c, "竞争性磋商").isEmpty());
    var bad =
        config(List.of(pair(score("A", "99.999999"), score("A", "99.999999"))), "comprehensive");
    assertTrue(
        AgencyEvaluationRules.blockers(bad, "竞争性磋商").stream().anyMatch(v -> v.contains("精确合计100")));
  }

  @Test
  void numericallyEqualScalesAreNotDifferences() {
    assertTrue(
        AgencyEvaluationRules.differences(
                config(List.of(pair(score("A", "100.000000"), score("A", "100"))), "comprehensive"))
            .isEmpty());
  }

  @Test
  void differentRulesRemainVisibleAndBlockFreeze() {
    var c = config(List.of(pair(score("A", "90"), score("A", "100"))), "comprehensive");
    var ds = AgencyEvaluationRules.differences(c);
    assertEquals("weight", ds.getFirst().field());
    assertEquals("90", ds.getFirst().documentValue());
    assertTrue(AgencyEvaluationRules.blockers(c, "竞争性磋商").stream().anyMatch(v -> v.contains("差异")));
  }

  @Test
  void rejectArbitraryFormulaAndTooMuchPrecision() {
    var a = score("A", "100");
    var code =
        new Criterion(
            a.key(),
            a.title(),
            a.stage(),
            a.applicableTo(),
            a.resultType(),
            a.minimum(),
            a.maximum(),
            a.weight(),
            "Runtime.exec('x')",
            true,
            2,
            "HALF_UP");
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyEvaluationRules.validate(config(List.of(pair(code, code)), "comprehensive")));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyEvaluationRules.validate(
                config(
                    List.of(pair(score("A", "0.1234567"), score("A", "0.1234567"))),
                    "comprehensive")));
  }

  @Test
  void procurementMethodDoesNotAutomaticallyChange() {
    var c = config(List.of(pair(score("A", "100"), score("A", "100"))), "comprehensive");
    for (String method : List.of("竞争性谈判", "询价", "单一来源"))
      assertTrue(
          AgencyEvaluationRules.blockers(c, method).stream().anyMatch(v -> v.contains("不匹配")));
    assertTrue(AgencyEvaluationRules.blockers(c, "邀请招标").isEmpty());
  }

  @Test
  void qualificationHasNoScoreAndRequiresItsOwnDuty() {
    var a =
        new Criterion(
            "Q",
            "资格审查",
            "qualification",
            "参与供应商",
            "pass_fail",
            BigDecimal.ZERO,
            BigDecimal.ZERO,
            BigDecimal.ZERO,
            "none",
            true,
            2,
            "HALF_UP");
    var c = config(List.of(pair(a, a)), "lowest_price");
    AgencyEvaluationRules.validate(c);
    assertTrue(
        AgencyEvaluationRules.blockers(c, "公开招标").stream()
            .anyMatch(v -> v.contains("qualification_reviewer")));
    var bad =
        new Criterion(
            "Q",
            "资格审查",
            "qualification",
            "参与供应商",
            "score",
            BigDecimal.ZERO,
            BigDecimal.TEN,
            new BigDecimal("100"),
            "weighted_normalized",
            true,
            2,
            "HALF_UP");
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyEvaluationRules.validate(config(List.of(pair(bad, bad)), "comprehensive")));
  }

  @Test
  void manualChecksAndDuplicateIdentitiesCannotBeSkipped() {
    var a = score("A", "100");
    var c = config(List.of(new RulePair(a, a, "第1页", false)), "comprehensive");
    assertTrue(
        AgencyEvaluationRules.blockers(c, "竞争性磋商").stream().anyMatch(v -> v.contains("人工核对")));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyEvaluationRules.validate(
                config(List.of(pair(a, a), pair(a, a)), "comprehensive")));
    var d =
        new Config(
            c.title(),
            c.documentRevisionId(),
            c.evaluationMethod(),
            c.ruleVersion(),
            c.ruleBasis(),
            c.venue(),
            c.scheduledAt(),
            List.of(
                new Member("u", List.of("organizer")), new Member("u", List.of("review_member"))),
            c.rules(),
            c.tieRule());
    assertThrows(IllegalArgumentException.class, () -> AgencyEvaluationRules.validate(d));
  }
}
