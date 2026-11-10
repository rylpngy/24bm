package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyEvaluationRecords.*;
import java.math.BigDecimal;
import java.util.*;

/**
 * Structural checks only. Applicable procurement rules must be reviewed against the source file.
 */
public final class AgencyEvaluationRules {
  private AgencyEvaluationRules() {}

  public static final Set<String> ROLES =
      Set.of(
          "purchaser_rep",
          "review_member",
          "leader",
          "qualification_reviewer",
          "conformity_reviewer",
          "organizer",
          "supervisor");
  public static final Set<String> METHODS =
      Set.of(
          "comprehensive", "lowest_price", "negotiation_price", "price_comparison", "consultation");

  private static void text(String s, int max, boolean required, String field) {
    if (required && (s == null || s.isBlank()) || s != null && s.length() > max)
      throw new IllegalArgumentException(field + "缺失或过长");
  }

  public static void validate(Config c) {
    if (c == null) throw new IllegalArgumentException("缺少评审配置");
    text(c.title(), 120, true, "轮次名称");
    text(c.documentRevisionId(), 150, true, "定稿版本");
    if (!METHODS.contains(Objects.toString(c.evaluationMethod(), "")))
      throw new IllegalArgumentException("评审方法不支持");
    text(c.ruleVersion(), 100, true, "规则版本");
    text(c.ruleBasis(), 2000, true, "适用规则依据");
    text(c.venue(), 300, false, "地点");
    text(c.tieRule(), 2000, false, "同分处理依据");
    if (c.members() == null
        || c.members().size() > 30
        || c.rules() == null
        || c.rules().size() > 100) throw new IllegalArgumentException("人员最多30人、规则最多100项");
    Set<String> users = new HashSet<>(), keys = new HashSet<>();
    for (var m : c.members()) {
      if (m == null
          || m.userId() == null
          || !users.add(m.userId())
          || m.roles() == null
          || m.roles().isEmpty()
          || new HashSet<>(m.roles()).size() != m.roles().size()
          || m.roles().stream().anyMatch(r -> r == null || !ROLES.contains(r)))
        throw new IllegalArgumentException("人员或职责无效、重复");
    }
    for (var p : c.rules()) {
      if (p == null) throw new IllegalArgumentException("规则为空");
      criterion(p.documentRule());
      criterion(p.configuredRule());
      text(p.locator(), 500, true, "原文定位");
      if (!p.documentRule().key().equals(p.configuredRule().key())
          || !keys.add(p.configuredRule().key())) throw new IllegalArgumentException("规则编号须对应且唯一");
    }
  }

  private static void criterion(Criterion c) {
    if (c == null) throw new IllegalArgumentException("缺少原文或配置规则");
    if (c.key() == null || !c.key().matches("[A-Za-z][A-Za-z0-9_-]{0,39}"))
      throw new IllegalArgumentException("规则编号不合法");
    text(c.title(), 300, true, "事项");
    text(c.applicableTo(), 500, true, "适用对象");
    if (!Set.of("qualification", "conformity", "technical", "commercial")
            .contains(Objects.toString(c.stage(), ""))
        || !Set.of("pass_fail", "score").contains(Objects.toString(c.resultType(), "")))
      throw new IllegalArgumentException("规则阶段或结果类型不支持");
    for (BigDecimal n : Arrays.asList(c.minimum(), c.maximum(), c.weight()))
      if (n == null || n.scale() > 6 || n.signum() < 0 || n.compareTo(new BigDecimal("10000")) > 0)
        throw new IllegalArgumentException("规则数值须为0至10000且最多6位小数");
    if (c.minimum().compareTo(c.maximum()) > 0
        || c.scale() < 0
        || c.scale() > 6
        || !Set.of("HALF_UP", "HALF_EVEN", "DOWN").contains(Objects.toString(c.rounding(), "")))
      throw new IllegalArgumentException("分值范围或小数规则无效");
    if (c.resultType().equals("pass_fail")) {
      if (!"none".equals(c.formula())
          || c.minimum().signum() != 0
          || c.maximum().signum() != 0
          || c.weight().signum() != 0) throw new IllegalArgumentException("审查结论项不配置分值或计算公式");
    } else if (!"weighted_normalized".equals(c.formula())
        || c.maximum().compareTo(c.minimum()) <= 0
        || c.minimum().signum() != 0
        || c.weight().signum() <= 0
        || c.weight().compareTo(new BigDecimal("100")) > 0
        || Set.of("qualification", "conformity").contains(c.stage()))
      throw new IllegalArgumentException("评分项须为技术或商务，零起分、正满分及权重；仅支持原始分/满分×权重");
  }

  public static List<Difference> differences(Config c) {
    List<Difference> out = new ArrayList<>();
    for (var p : c.rules()) {
      var a = values(p.documentRule());
      var b = values(p.configuredRule());
      for (String field : a.keySet())
        if (!a.get(field).equals(b.get(field)))
          out.add(new Difference(p.configuredRule().key(), field, a.get(field), b.get(field)));
    }
    return out;
  }

  private static Map<String, String> values(Criterion c) {
    Map<String, String> m = new LinkedHashMap<>();
    m.put("title", c.title());
    m.put("stage", c.stage());
    m.put("applicableTo", c.applicableTo());
    m.put("resultType", c.resultType());
    m.put("minimum", c.minimum().stripTrailingZeros().toPlainString());
    m.put("maximum", c.maximum().stripTrailingZeros().toPlainString());
    m.put("weight", c.weight().stripTrailingZeros().toPlainString());
    m.put("formula", c.formula());
    m.put("evidenceRequired", String.valueOf(c.evidenceRequired()));
    m.put("scale", String.valueOf(c.scale()));
    m.put("rounding", c.rounding());
    return m;
  }

  public static List<String> blockers(Config c, String method) {
    List<String> issues = new ArrayList<>();
    var permitted = AgencyMethodPolicy.permitted(method);
    if (!permitted.contains(c.evaluationMethod())) issues.add("评审方法与采购方式不匹配");
    if (c.venue() == null || c.venue().isBlank() || c.scheduledAt() == null)
      issues.add("需明确计划时间和地点");
    if (c.members().isEmpty()) issues.add("需明确承担职责的人员");
    if (c.members().stream().noneMatch(m -> m.roles().contains("organizer")))
      issues.add("需明确项目组织人员");
    if (c.rules().isEmpty()) issues.add("需逐项录入原文规则及系统配置");
    if (c.rules().stream().anyMatch(r -> !r.manuallyChecked())) issues.add("存在未经逐项人工核对的规则");
    if (!differences(c).isEmpty()) issues.add("采购文件规则与系统配置存在差异");
    BigDecimal weights = BigDecimal.ZERO;
    int scores = 0;
    for (var p : c.rules())
      if (p.configuredRule().resultType().equals("score")) {
        scores++;
        weights = weights.add(p.configuredRule().weight());
      }
    if (c.evaluationMethod().equals("comprehensive")) {
      if (scores == 0 || weights.compareTo(new BigDecimal("100")) != 0)
        issues.add("综合评分权重须精确合计100，且包含评分项");
      if (c.tieRule() == null || c.tieRule().isBlank()) issues.add("需明确同分处理依据");
    } else if (scores != 0) issues.add("当前评审方法不得配置技术商务综合评分");
    for (var p : c.rules()) {
      String role =
          switch (p.configuredRule().stage()) {
            case "qualification" -> "qualification_reviewer";
            case "conformity" -> "conformity_reviewer";
            default -> "review_member";
          };
      if (c.members().stream().noneMatch(m -> m.roles().contains(role))
          && !c.evaluationMethod().equals("consultation"))
        issues.add("规则 " + p.configuredRule().key() + " 缺少对应职责：" + role);
    }
    return issues.stream().distinct().toList();
  }
}
