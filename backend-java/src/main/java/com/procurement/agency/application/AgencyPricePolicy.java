package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyEvaluationRecords.Criterion;
import com.procurement.agency.domain.AgencyPriceRecords.*;
import java.math.*;
import java.util.*;

/** Fixed decimal formulas only. No scripts, implicit fallbacks, ranking or result confirmation. */
public final class AgencyPricePolicy {
  private AgencyPricePolicy() {}

  public static void validate(Rule r) {
    if (r == null
        || !Set.of("original", "corrected", "policy", "final_original")
            .contains(Objects.toString(r.priceSource(), ""))
        || !Set.of("minimum_ratio", "price_comparison").contains(Objects.toString(r.formula(), "")))
      throw new IllegalArgumentException("须明确价格来源和受支持的价格公式");
    if (r.fullScore() == null
        || r.fullScore().signum() < 0
        || r.fullScore().compareTo(new BigDecimal("100")) > 0
        || r.fullScore().scale() > 6
        || r.scale() < 0
        || r.scale() > 6
        || !Set.of("HALF_UP", "HALF_EVEN", "DOWN").contains(Objects.toString(r.rounding(), "")))
      throw new IllegalArgumentException("满分0至100，最多6位小数，结果保留0至6位且明确舍入方式");
    if (r.tieRule() == null || r.tieRule().isBlank() || r.tieRule().length() > 2000)
      throw new IllegalArgumentException("须明确同价或同分的后续处理依据");
    if (r.formula().equals("minimum_ratio")
        && (r.fullScore().signum() <= 0
            || r.criterionKey() == null
            || !r.criterionKey().matches("[A-Za-z][A-Za-z0-9_-]{0,39}")))
      throw new IllegalArgumentException("比例价格分须绑定冻结价格项并明确正满分");
    if (r.formula().equals("price_comparison")
        && (r.fullScore().signum() != 0 || r.criterionKey() != null && !r.criterionKey().isBlank()))
      throw new IllegalArgumentException("单纯价格比较不配置评分项或满分");
  }

  public static List<String> differences(Rule a, Rule b) {
    List<String> out = new ArrayList<>();
    if (!Objects.equals(a.priceSource(), b.priceSource())) out.add("价格来源");
    if (!Objects.equals(a.formula(), b.formula())) out.add("公式");
    if (!Objects.equals(a.criterionKey(), b.criterionKey())) out.add("冻结价格项编号");
    if (a.fullScore().compareTo(b.fullScore()) != 0) out.add("满分/权重");
    if (a.scale() != b.scale()) out.add("保留位数");
    if (!Objects.equals(a.rounding(), b.rounding())) out.add("舍入方式");
    if (!Objects.equals(a.tieRule(), b.tieRule())) out.add("同价/同分依据");
    return out;
  }

  public static List<String> blockers(
      Rule r, String method, String evaluationMethod, List<Criterion> criteria) {
    List<String> out = new ArrayList<>();
    if (!AgencyMethodPolicy.permitted(method).contains(evaluationMethod)) out.add("评审方法与采购方式不匹配");
    boolean finals = Set.of("竞争性谈判", "竞争性磋商").contains(method);
    if (method.equals("单一来源")) out.add("单一来源不进行竞争性价格比较或价格分计算");
    if (finals != r.priceSource().equals("final_original"))
      out.add("谈判/磋商只读取已确认最后报价，其他方式使用明确的初次报价层");
    if (evaluationMethod.equals("comprehensive")) {
      if (!r.formula().equals("minimum_ratio")) out.add("综合评分须明确独立价格分公式");
      var criterion =
          criteria.stream().filter(c -> c.key().equals(r.criterionKey())).findFirst().orElse(null);
      if (criterion == null
          || !criterion.stage().equals("commercial")
          || !criterion.resultType().equals("score")
          || criterion.weight().compareTo(r.fullScore()) != 0)
        out.add("价格满分须匹配冻结商务价格项权重；不得额外叠加总权重");
    } else if (!r.formula().equals("price_comparison")) out.add("当前评审方法只记录价格比较，不配置技术商务综合价格分");
    return out;
  }

  public static Trace calculate(Rule rule, List<Line> sources) {
    validate(rule);
    if (sources == null || sources.isEmpty()) throw new IllegalArgumentException("缺少价格来源");
    for (var line : sources) {
      AgencyQuoteService.amount(line.price());
      if (rule.formula().equals("minimum_ratio") && line.price().signum() == 0)
        throw new IllegalArgumentException("比例价格分包含零价格，须按适用规则处理，不能除零或自动补价");
    }
    if (sources.stream().map(Line::currency).distinct().count() != 1)
      throw new IllegalArgumentException("不得混币种计算");
    BigDecimal minimum = sources.stream().map(Line::price).min(BigDecimal::compareTo).orElseThrow();
    boolean scoring = rule.formula().equals("minimum_ratio");
    BigDecimal numerator = scoring ? minimum.multiply(rule.fullScore()) : null;
    var lines =
        sources.stream()
            .map(
                l ->
                    new Line(
                        l.participationId(),
                        l.supplierName(),
                        l.sourceId(),
                        l.sourceHash(),
                        l.sourceKind(),
                        l.price(),
                        l.currency(),
                        numerator,
                        scoring
                            ? numerator.divide(
                                l.price(), rule.scale(), RoundingMode.valueOf(rule.rounding()))
                            : null))
            .toList();
    return new Trace(
        rule.formula(),
        minimum,
        rule.fullScore(),
        rule.scale(),
        rule.rounding(),
        scoring ? "minimum × fullScore ÷ price；乘积不舍入，仅最终除法按指定位数舍入" : "直接比较原十进制价格；不舍入价格，不生成分值或排名",
        lines);
  }
}
