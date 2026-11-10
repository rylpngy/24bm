package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyEvaluationRecords.Criterion;
import com.procurement.agency.domain.AgencyPriceRecords;
import com.procurement.agency.domain.AgencyTotalRecords.*;
import java.math.*;
import java.util.*;

public final class AgencyTotalPolicy {
  private AgencyTotalPolicy() {}

  public record Sample(String userId, String sheetId, String hash, BigDecimal score) {}

  public static void validate(Rule r) {
    if (r == null
        || !"mean_raw_then_weight".equals(r.method())
        || r.totalScale() < 0
        || r.totalScale() > 6
        || !Set.of("HALF_UP", "HALF_EVEN", "DOWN").contains(Objects.toString(r.totalRounding(), ""))
        || !"manual_pending".equals(r.tieHandling()))
      throw new IllegalArgumentException("须明确等权原始分汇总、0至6位总分舍入及同分待人工处理；不执行自由公式");
    if (r.sources() == null || r.sources().isEmpty() || r.sources().size() > 100)
      throw new IllegalArgumentException("须逐项明确唯一计分来源");
    Set<String> keys = new HashSet<>();
    for (var source : r.sources())
      if (source == null
          || source.criterionKey() == null
          || !source.criterionKey().matches("[A-Za-z][A-Za-z0-9_-]{0,39}")
          || !keys.add(source.criterionKey())
          || !Set.of("member_mean", "objective_price")
              .contains(Objects.toString(source.source(), "")))
        throw new IllegalArgumentException("计分项重复或来源无效");
  }

  private static Map<String, String> mapping(Rule r) {
    Map<String, String> m = new TreeMap<>();
    r.sources().forEach(s -> m.put(s.criterionKey(), s.source()));
    return m;
  }

  public static List<String> differences(Rule a, Rule b) {
    List<String> out = new ArrayList<>();
    if (!a.method().equals(b.method())) out.add("成员汇总方法");
    if (a.totalScale() != b.totalScale()) out.add("总分保留位数");
    if (!a.totalRounding().equals(b.totalRounding())) out.add("总分舍入方式");
    if (!a.tieHandling().equals(b.tieHandling())) out.add("同分处理");
    if (!mapping(a).equals(mapping(b))) out.add("逐项计分来源");
    return out;
  }

  public static List<String> blockers(
      Rule r, String evaluationMethod, List<Criterion> criteria, AgencyPriceRecords.Rule price) {
    List<String> out = new ArrayList<>();
    if (!"comprehensive".equals(evaluationMethod)) out.add("本汇总仅适用于综合评分，其他方法不能套用总分");
    var scoreRules = criteria.stream().filter(c -> c.resultType().equals("score")).toList();
    Set<String> keys = new HashSet<>();
    scoreRules.forEach(c -> keys.add(c.key()));
    if (!mapping(r).keySet().equals(keys)) out.add("须覆盖全部冻结评分项，不得缺项、加项或重复计分");
    var objective = r.sources().stream().filter(s -> s.source().equals("objective_price")).toList();
    if (price == null || !price.formula().equals("minimum_ratio")) out.add("须先冻结综合评分的客观价格分规则");
    if (objective.size() != 1
        || price == null
        || !objective.getFirst().criterionKey().equals(price.criterionKey()))
      out.add("恰好一个价格项须唯一使用客观价格计算；不得再计入其人工分");
    if (scoreRules.stream()
            .map(Criterion::weight)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .compareTo(new BigDecimal("100"))
        != 0) out.add("全部冻结评分权重须精确合计100");
    if (price != null && objective.size() == 1 && keys.equals(mapping(r).keySet())) {
      BigDecimal max = BigDecimal.ZERO;
      for (var c : scoreRules) {
        boolean p = objective.getFirst().criterionKey().equals(c.key());
        max =
            max.add(
                c.weight()
                    .setScale(
                        p ? price.scale() : c.scale(),
                        RoundingMode.valueOf(p ? price.rounding() : c.rounding())));
      }
      if (max.setScale(r.totalScale(), RoundingMode.valueOf(r.totalRounding()))
              .compareTo(new BigDecimal("100"))
          != 0) out.add("现有分项及总分舍入组合使满分不等于100，请核对定稿，不自动裁剪");
    }
    return out;
  }

  public static Component member(Criterion c, Set<String> expected, List<Sample> samples) {
    if (expected == null
        || expected.isEmpty()
        || samples == null
        || samples.size() != expected.size()
        || !samples.stream()
            .map(Sample::userId)
            .collect(java.util.stream.Collectors.toSet())
            .equals(expected)) throw new IllegalArgumentException("必须使用本项全部冻结职责成员的唯一有效提交，不能选人剔分");
    if (c.maximum().signum() <= 0 || !c.formula().equals("weighted_normalized"))
      throw new IllegalArgumentException("成员项缺少受支持的冻结加权公式");
    BigDecimal sum = BigDecimal.ZERO;
    List<Reference> refs = new ArrayList<>();
    for (var s : samples) {
      if (s.score() == null
          || s.score().scale() > 6
          || s.score().compareTo(c.minimum()) < 0
          || s.score().compareTo(c.maximum()) > 0)
        throw new IllegalArgumentException("成员分值缺失或超出冻结范围，不能补填");
      sum = sum.add(s.score());
      refs.add(new Reference(s.sheetId(), s.hash(), s.userId()));
    }
    BigDecimal numerator = sum.multiply(c.weight()),
        denominator = c.maximum().multiply(BigDecimal.valueOf(samples.size()));
    BigDecimal value = numerator.divide(denominator, c.scale(), RoundingMode.valueOf(c.rounding()));
    return new Component(
        c.key(),
        c.title(),
        "member_mean",
        samples.size(),
        refs,
        sum,
        c.maximum(),
        c.weight(),
        numerator,
        denominator,
        c.scale(),
        c.rounding(),
        value);
  }

  public static Component objective(
      Criterion c,
      AgencyPriceRecords.Rule price,
      AgencyPriceRecords.Line line,
      String id,
      String hash) {
    if (c.weight().compareTo(price.fullScore()) != 0
        || !c.key().equals(price.criterionKey())
        || line.score() == null
        || line.score().signum() < 0
        || line.score()
                .compareTo(
                    price
                        .fullScore()
                        .setScale(price.scale(), RoundingMode.valueOf(price.rounding())))
            > 0) throw new IllegalArgumentException("客观价格分与冻结价格项不匹配");
    return new Component(
        c.key(),
        c.title(),
        "objective_price",
        0,
        List.of(new Reference(id, hash, null)),
        null,
        c.maximum(),
        c.weight(),
        line.numerator(),
        line.price(),
        price.scale(),
        price.rounding(),
        line.score());
  }

  public static SubjectTotal total(Rule rule, String id, String name, List<Component> components) {
    BigDecimal sum =
        components.stream().map(Component::value).reduce(BigDecimal.ZERO, BigDecimal::add);
    return new SubjectTotal(
        id,
        name,
        components,
        sum,
        sum.setScale(rule.totalScale(), RoundingMode.valueOf(rule.totalRounding())));
  }

  public static List<Tie> ties(List<SubjectTotal> subjects) {
    Map<BigDecimal, List<String>> grouped = new LinkedHashMap<>();
    for (var s : subjects)
      grouped
          .computeIfAbsent(s.total().stripTrailingZeros(), v -> new ArrayList<>())
          .add(s.participationId());
    return grouped.values().stream()
        .filter(ids -> ids.size() > 1)
        .map(
            ids ->
                new Tie(
                    subjects.stream()
                        .filter(s -> s.participationId().equals(ids.getFirst()))
                        .findFirst()
                        .orElseThrow()
                        .total(),
                    List.copyOf(ids)))
        .toList();
  }
}
