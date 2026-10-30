package com.procurement.buyer.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.FundingContracts.Balance;
import com.procurement.buyer.infrastructure.*;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public record FundingCorrectionService(
    FundingMapper funds,
    FundingCorrectionMapper corrections,
    ProcurementProjectMapper projects,
    ProjectLifecycleMapper lifecycle,
    AuditLogApplicationService audit) {
  @Schema(name = "FundingCorrectionTarget")
  public record Target(String sourceFundId, String targetFundId) {}

  @Schema(name = "FundingCorrectionSource")
  public record Source(String fundId, String code, String name, String period, BigDecimal amount) {}

  @Schema(name = "FundingCorrectionChoice")
  public record Choice(
      String fundId, String code, String name, BigDecimal availableAmount, int revision) {}

  @Schema(name = "FundingCorrectionOptions")
  public record Options(boolean enabled, List<Source> sources, List<Choice> choices) {}

  public record Line(
      String sourceFundId,
      String sourceCode,
      String sourceName,
      String sourcePeriod,
      String sourcePlan,
      String targetFundId,
      String targetCode,
      String targetName,
      int targetRevision,
      BigDecimal amount) {}

  public record Snapshot(
      String projectId,
      String currentPlan,
      String period,
      BigDecimal priorPaidAmount,
      List<Balance> currentBalances,
      List<Line> lines) {}

  public Options options(String t, String invoice, String entry) {
    var old = corrections.original(t, invoice, entry);
    if (old.isEmpty()) {
      if (funds.invoiceProjects(t, invoice).stream()
          .filter(p -> !p.isBlank())
          .anyMatch(p -> !funds.balances(t, p).isEmpty()))
        throw new IllegalStateException("原付款专项来源缺失，不能推算更正");
      return new Options(false, List.of(), List.of());
    }
    var p = project(old);
    String plan = funds.plan(t, p), period = lifecycle.period(t, p);
    if (plan == null
        || period == null
        || old.stream()
            .anyMatch(o -> plan.equals(o.changeId()) || o.period().compareTo(period) >= 0))
      throw new IllegalStateException("原专项付款尚未形成可核验的历史来源版本");
    var sources =
        old.stream()
            .map(o -> new Source(o.fundId(), o.code(), o.name(), o.period(), o.amount()))
            .toList();
    var choices =
        funds.balances(t, p).stream()
            .map(b -> funds.fund(t, b.fundId()))
            .filter(Objects::nonNull)
            .filter(f -> f.period().equals(period) && f.status().equals("approved"))
            .map(f -> new Choice(f.id(), f.code(), f.name(), f.availableAmount(), f.revision()))
            .toList();
    return new Options(true, sources, choices);
  }

  public boolean pending(String t, String invoice, String entry) {
    var original = corrections.original(t, invoice, entry);
    return !original.isEmpty() && corrections.pending(t, project(original), "") > 0;
  }

  public Snapshot prepare(
      String t, String invoice, String entry, List<Target> targets, String ignore) {
    funds.lock(t);
    var old = corrections.original(t, invoice, entry);
    if (old.isEmpty()) {
      if (targets != null && !targets.isEmpty())
        throw new IllegalArgumentException("原付款没有专项归属，不应提交回补来源");
      return null;
    }
    String p = project(old), plan = funds.plan(t, p), period = lifecycle.period(t, p);
    var project = projects.find(t, p);
    if (project == null
        || !"approved".equals(project.status())
        || lifecycle.pending(t, p) > 0
        || funds.pending(t, null, p) > 0
        || corrections.pending(t, p, Objects.toString(ignore, "")) > 0)
      throw new IllegalStateException("项目状态不允许更正，或已有承接、分摊、专项更正审批，请先处理");
    options(t, invoice, entry);
    var total = old.stream().map(o -> o.amount()).reduce(BigDecimal.ZERO, BigDecimal::add);
    if (old.stream().anyMatch(o -> o.amount().signum() <= 0)
        || total.compareTo(old.getFirst().entryAmount()) != 0)
      throw new IllegalStateException("原付款专项来源金额与实际流水不一致");
    if (funds.priorPaid(t, p).compareTo(total) < 0)
      throw new IllegalStateException("历史已付基线不足，不能推算更正");
    if (targets == null || targets.size() != old.size())
      throw new IllegalArgumentException("请为每个原付款资金来源明确选择当前年度回补来源");
    Map<String, String> selected = new HashMap<>();
    for (var target : targets)
      if (target == null
          || target.sourceFundId() == null
          || target.targetFundId() == null
          || selected.putIfAbsent(target.sourceFundId(), target.targetFundId()) != null)
        throw new IllegalArgumentException("原付款来源不得重复或为空");
    var balances = funds.balances(t, p);
    var totals = new HashMap<String, BigDecimal>();
    var lines = new ArrayList<Line>();
    for (var o : old) {
      String id = selected.remove(o.fundId());
      var fund = id == null ? null : funds.fund(t, id);
      if (fund == null
          || balances.stream().noneMatch(b -> b.fundId().equals(id))
          || !fund.departmentId().equals(project.departmentId())
          || !period.equals(fund.period())
          || !"approved".equals(fund.status()))
        throw new IllegalArgumentException("回补来源须为项目当前版本中同部门、当前年度的已批准资金");
      totals.merge(id, o.amount(), BigDecimal::add);
      lines.add(
          new Line(
              o.fundId(),
              o.code(),
              o.name(),
              o.period(),
              o.changeId(),
              id,
              fund.code(),
              fund.name(),
              fund.revision(),
              o.amount()));
    }
    if (!selected.isEmpty()) throw new IllegalArgumentException("回补映射包含非原付款来源");
    for (var target : totals.entrySet())
      if (target.getValue().compareTo(funds.fund(t, target.getKey()).availableAmount()) > 0)
        throw new IllegalStateException("当前年度回补来源可用额度不足，请先批准额度调整");
    return new Snapshot(p, plan, period, funds.priorPaid(t, p), balances, List.copyOf(lines));
  }

  public void apply(
      String t,
      String invoice,
      String entry,
      String reversal,
      String correction,
      Snapshot snapshot,
      String actor) {
    if (snapshot == null) return;
    for (var l : snapshot.lines()) {
      funds.payment(
          t,
          reversal,
          snapshot.projectId(),
          l.sourceFundId(),
          l.sourcePlan(),
          l.amount().negate(),
          actor);
      corrections.restore(
          t,
          correction,
          snapshot.projectId(),
          entry,
          l.sourceFundId(),
          l.targetFundId(),
          snapshot.currentPlan(),
          l.amount(),
          actor);
    }
    audit.recordTenantAction(
        t,
        "funding.frozen_payment_corrected",
        "invoice",
        invoice,
        correction + ":" + entry + ":" + reversal);
  }

  private String project(List<FundingCorrectionMapper.Original> old) {
    var ids = old.stream().map(FundingCorrectionMapper.Original::projectId).distinct().toList();
    if (ids.size() != 1) throw new IllegalStateException("原付款专项项目归属不唯一");
    return ids.getFirst();
  }
}
