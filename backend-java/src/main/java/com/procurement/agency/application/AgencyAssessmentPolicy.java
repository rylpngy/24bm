package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyAssessmentRecords.*;
import com.procurement.agency.domain.AgencyEvaluationRecords.*;
import java.util.*;

public final class AgencyAssessmentPolicy {
  private AgencyAssessmentPolicy() {}

  public static List<Criterion> assigned(Config c, String user) {
    var m =
        c.members().stream()
            .filter(v -> v.userId().equals(user))
            .findFirst()
            .orElseThrow(
                () -> new com.procurement.common.tenant.PermissionDeniedException("当前账号不在冻结人员中"));
    return c.rules().stream()
        .map(RulePair::configuredRule)
        .filter(
            r ->
                m.roles()
                    .contains(
                        switch (r.stage()) {
                          case "qualification" -> "qualification_reviewer";
                          case "conformity" -> "conformity_reviewer";
                          default -> "review_member";
                        }))
        .toList();
  }

  public static void validate(
      List<Subject> subjects, List<Criterion> criteria, List<Entry> entries, boolean complete) {
    if (entries == null || entries.size() > 3000) throw new IllegalArgumentException("个人意见最多3000项");
    Set<String> validSubjects = new HashSet<>();
    subjects.forEach(s -> validSubjects.add(s.participationId()));
    Map<String, Criterion> rules = new HashMap<>();
    criteria.forEach(c -> rules.put(c.key(), c));
    Set<Cell> cells = new HashSet<>();
    for (var e : entries) {
      if (e == null
          || !validSubjects.contains(e.participationId())
          || !rules.containsKey(e.criterionKey())
          || !cells.add(new Cell(e.participationId(), e.criterionKey())))
        throw new IllegalArgumentException("存在重复或不属于本人任务的评审项");
      var r = rules.get(e.criterionKey());
      text(e.evidence(), 4000, false);
      text(e.opinion(), 4000, complete);
      if (r.resultType().equals("score")) {
        if (e.conclusion() != null && !e.conclusion().isBlank())
          throw new IllegalArgumentException("评分项不填写审查结论");
        if (e.score() != null
            && (e.score().scale() > 6
                || e.score().compareTo(r.minimum()) < 0
                || e.score().compareTo(r.maximum()) > 0))
          throw new IllegalArgumentException("评分超出冻结分值范围或精度");
        if (complete && e.score() == null) throw new IllegalArgumentException("存在未填写分值");
      } else {
        if (e.score() != null) throw new IllegalArgumentException("审查项不得填写分值");
        if (e.conclusion() != null
            && !e.conclusion().isBlank()
            && !Set.of("pass", "fail").contains(e.conclusion()))
          throw new IllegalArgumentException("审查结论须为通过或不通过");
        if (complete && (e.conclusion() == null || e.conclusion().isBlank()))
          throw new IllegalArgumentException("存在未填写审查结论");
      }
      if (complete && r.evidenceRequired()) text(e.evidence(), 4000, true);
    }
    if (complete && cells.size() != subjects.size() * criteria.size())
      throw new IllegalArgumentException("须完成本人的全部对象及评审项后独立提交");
  }

  public static void correctionScope(
      List<Entry> original, List<Entry> changed, List<Cell> allowed) {
    Map<Cell, Entry> a = new HashMap<>(), b = new HashMap<>();
    original.forEach(e -> a.put(new Cell(e.participationId(), e.criterionKey()), e));
    changed.forEach(e -> b.put(new Cell(e.participationId(), e.criterionKey()), e));
    for (var cell : a.keySet())
      if (!allowed.contains(cell) && !equal(a.get(cell), b.get(cell)))
        throw new IllegalArgumentException("更正超出已审批对象或评审项范围");
  }

  private static boolean equal(Entry a, Entry b) {
    return b != null
        && a.participationId().equals(b.participationId())
        && a.criterionKey().equals(b.criterionKey())
        && (a.score() == null
            ? b.score() == null
            : b.score() != null && a.score().compareTo(b.score()) == 0)
        && Objects.equals(a.conclusion(), b.conclusion())
        && Objects.equals(a.evidence(), b.evidence())
        && Objects.equals(a.opinion(), b.opinion());
  }

  private static void text(String s, int max, boolean required) {
    if (required && (s == null || s.isBlank()) || s != null && s.length() > max)
      throw new IllegalArgumentException("评审依据或意见缺失、过长");
  }
}
