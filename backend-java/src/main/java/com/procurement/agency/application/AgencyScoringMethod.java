package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyEvaluationRecords.*;
import java.math.BigDecimal;
import java.util.*;

public record AgencyScoringMethod(List<Criterion> criteria, String tieRule) {
  public static final String SETTING = "structuredScoring";

  public static AgencyScoringMethod parse(AgencyExecutionSupport s, String raw) {
    if (raw == null || raw.isBlank()) return null;
    s.text(raw, 60000, true, "结构化评分办法");
    var method = s.json.read(raw, AgencyScoringMethod.class);
    if (method == null || method.criteria() == null || method.criteria().isEmpty())
      throw new IllegalArgumentException("请至少录入一项评分规则");
    s.text(method.tieRule(), 2000, true, "同分处理规则");
    if (raw.contains("{{")) throw new IllegalArgumentException("评分办法须填写已确定的文本，不使用模板占位符");
    var keys = new HashSet<String>();
    for (Criterion rule : method.criteria()) {
      AgencyEvaluationRules.criterion(rule);
      if (!keys.add(rule.key())) throw new IllegalArgumentException("评分项编号必须唯一");
      if ("pass_fail".equals(rule.resultType()) && !Set.of("qualification", "conformity").contains(rule.stage()))
        throw new IllegalArgumentException("通过类审查项须选择资格或符合性阶段");
    }
    if (method.criteria().size() > 100 || method.criteria().stream().filter(rule -> "score".equals(rule.resultType())).map(Criterion::weight)
        .reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(new BigDecimal("100")) != 0)
      throw new IllegalArgumentException("最多录入100项，计分权重合计须为100");
    return method;
  }

  public String body() {
    var lines = new ArrayList<String>();
    lines.add("专家对照纸质投标文件独立评分。计分项按原始分 ÷ 满分 × 权重换算。");
    for (var rule : criteria) {
      lines.add(rule.key() + " " + rule.title() + "（" + switch (rule.stage()) {
        case "qualification" -> "资格审查";
        case "conformity" -> "符合性审查";
        case "technical" -> "技术";
        default -> "商务";
      } + "）");
      lines.add("评分标准：" + rule.applicableTo());
      if ("pass_fail".equals(rule.resultType())) {
        lines.add("结论：通过／不通过；依据" + (rule.evidenceRequired() ? "必填" : "选填"));
        continue;
      }
      lines.add("原始分 " + rule.minimum().toPlainString() + "–" + rule.maximum().toPlainString()
          + "；权重 " + rule.weight().toPlainString() + "；保留 " + rule.scale() + " 位小数（"
          + switch (rule.rounding()) {
            case "HALF_EVEN" -> "五成双";
            case "DOWN" -> "向下截断";
            default -> "四舍五入";
          } + "）；评分依据" + (rule.evidenceRequired() ? "必填" : "选填"));
    }
    lines.add("各专家的折算分先逐项舍入、按供应商合计，再取专家平均分并四舍五入至两位。");
    lines.add("同分处理：" + tieRule);
    return String.join("\n", lines);
  }

  public boolean matches(Config config) {
    if (!"comprehensive".equals(config.evaluationMethod()) || !tieRule.equals(config.tieRule())
        || config.rules().size() != criteria.size()) return false;
    for (int i = 0; i < criteria.size(); i++) {
      var pair = config.rules().get(i);
      var expected = criteria.get(i);
      if (!expected.key().equals(pair.documentRule().key())
          || !expected.key().equals(pair.configuredRule().key())
          || !AgencyEvaluationRules.values(expected).equals(AgencyEvaluationRules.values(pair.documentRule()))
          || !AgencyEvaluationRules.values(expected).equals(AgencyEvaluationRules.values(pair.configuredRule()))) return false;
    }
    return true;
  }
}
