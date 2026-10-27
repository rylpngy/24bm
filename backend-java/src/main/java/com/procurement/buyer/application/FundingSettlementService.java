package com.procurement.buyer.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.domain.FundingAllocationPolicy;
import com.procurement.buyer.domain.FundingAllocationPolicy.Share;
import com.procurement.buyer.infrastructure.*;
import com.procurement.identity.application.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public record FundingSettlementService(
    FundingMapper funds,
    FundingSettlementMapper cash,
    ProcurementProjectMapper projects,
    ProjectLifecycleMapper lifecycle,
    FundingCarryoverService carryover,
    PermissionService permissions,
    DataScopeService scopes,
    AuditLogApplicationService audit,
    ObjectMapper json) {
  public record Source(
      String fundId,
      String code,
      String name,
      int revision,
      BigDecimal allocatedAmount,
      BigDecimal paidAmount,
      BigDecimal remainingAmount) {}

  public record Allocation(String fundId, BigDecimal amount) {}

  public record Original(String source, String fundId, BigDecimal amount) {}

  public record CashEntry(
      String evidenceId, String fundId, String code, String name, BigDecimal amount) {}

  public record Basis(
      String projectId,
      String planId,
      String period,
      List<Source> sources,
      List<Original> original) {}

  public Basis prepare(String t, String order, BigDecimal paid, String ignore, boolean access) {
    var ids = funds.orderProjects(t, order);
    boolean enabled =
        ids.stream()
            .filter(id -> !id.isBlank())
            .anyMatch(id -> !funds.balances(t, id).isEmpty() || funds.pending(t, null, id) > 0);
    if (!enabled) return null;
    if (ids.size() != 1 || ids.getFirst().isBlank())
      throw new IllegalStateException("混合项目订单不能直接进行专项清算");
    if (access) {
      funds.lock(t);
      permissions.require("buyer:budget:manage");
      permissions.require("buyer:budget:read");
    }
    var p = projects.find(t, ids.getFirst());
    String plan = funds.plan(t, p.id());
    if (!"approved".equals(p.status())
        || funds.pending(t, null, p.id()) > 0
        || funds.pendingCorrection(t, p.id()) > 0
        || lifecycle.pending(t, p.id()) > 0
        || cash.pending(t, p.id(), Objects.toString(ignore, "")) > 0)
      throw new IllegalStateException("项目存在在审资金、承接、更正或其他清算，请先处理");
    if (plan == null || cash.historical(t, order, plan) || funds.priorPaid(t, p.id()).signum() > 0)
      throw new IllegalStateException("跨年度冻结来源清算尚未开放，不能改写历史归属");
    var original = cash.original(t, order);
    if (original.stream()
            .map(FundingSettlementMapper.Cash::amount)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .compareTo(paid)
        != 0) throw new IllegalStateException("原订单实际付款与专项来源归属不一致，不能补造分账");
    var own = ignore == null ? List.<FundingSettlementMapper.Cash>of() : cash.current(t, ignore);
    var sources = new ArrayList<Source>();
    for (var b : funds.balances(t, p.id())) {
      var f = funds.fund(t, b.fundId());
      if (f == null
          || !f.departmentId().equals(p.departmentId())
          || !f.period().equals(carryover.period(p))
          || !"approved".equals(f.status())) throw new IllegalStateException("清算来源部门、年度或状态不一致");
      if (access) scopes.requireRecordAccess(f.departmentId(), f.createdBy());
      BigDecimal adjustment =
          own.stream()
              .filter(x -> x.fundId().equals(f.id()))
              .map(FundingSettlementMapper.Cash::amount)
              .reduce(BigDecimal.ZERO, BigDecimal::add);
      sources.add(
          new Source(
              f.id(),
              f.code(),
              f.name(),
              f.revision(),
              b.allocatedAmount(),
              b.paidAmount().subtract(adjustment),
              b.remainingAmount().add(adjustment)));
    }
    if (sources.stream()
                .map(Source::allocatedAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .compareTo(p.plannedAmount())
            != 0
        || sources.stream()
            .anyMatch(s -> s.paidAmount().signum() < 0 || s.remainingAmount().signum() < 0))
      throw new IllegalStateException("项目专项责任与批准金额不一致");
    return new Basis(
        p.id(),
        plan,
        carryover.period(p),
        List.copyOf(sources),
        original.stream().map(x -> new Original(x.source(), x.fundId(), x.amount())).toList());
  }

  public Basis read(String snapshot) {
    try {
      var v = json.readTree(snapshot).path("funding");
      return v.isMissingNode() || v.isNull() ? null : json.treeToValue(v, Basis.class);
    } catch (Exception e) {
      throw new IllegalStateException("专项清算依据读取失败", e);
    }
  }

  public void validate(String t, String order, String id, String snapshot, BigDecimal paid) {
    funds.lock(t);
    var old = read(snapshot);
    var now = prepare(t, order, paid, id, false);
    if (!json.valueToTree(old).equals(json.valueToTree(now)))
      throw new IllegalStateException("专项来源、资金版本或原付款已变化，请重新申请清算");
  }

  private List<Share> shares(List<Allocation> input) {
    return input == null
        ? null
        : input.stream()
            .map(
                x -> {
                  if (x == null) throw new IllegalArgumentException("资金来源不得为空");
                  return new Share(x.fundId(), x.amount());
                })
            .toList();
  }

  public boolean matches(String t, String id, List<Allocation> lines) {
    return matchesRows(shares(lines), cashForEvidence(t, id));
  }

  private List<FundingSettlementMapper.Entry> cashForEvidence(String t, String id) {
    return cash.evidence(t, id);
  }

  private boolean matchesRows(List<Share> lines, List<FundingSettlementMapper.Entry> old) {
    if (old.isEmpty()) return lines == null || lines.isEmpty();
    try {
      var total = old.stream().map(x -> x.amount().abs()).reduce(BigDecimal.ZERO, BigDecimal::add);
      var normalized = FundingAllocationPolicy.requireTotal(lines, total);
      return normalized.size() == old.size()
          && normalized.stream()
              .allMatch(
                  s ->
                      old.stream()
                          .anyMatch(
                              o ->
                                  o.fundId().equals(s.fundId())
                                      && o.amount().abs().compareTo(s.amount()) == 0));
    } catch (IllegalArgumentException e) {
      return false;
    }
  }

  public void record(
      String t,
      String order,
      String id,
      String evidence,
      String snapshot,
      String kind,
      String source,
      BigDecimal amount,
      List<Allocation> lines,
      String actor) {
    var basis = read(snapshot);
    boolean isCash = Set.of("refund", "payment").contains(kind);
    if (basis == null || !isCash) {
      if (lines != null && !lines.isEmpty()) throw new IllegalArgumentException("非专项现金凭证不应填写资金来源");
      return;
    }
    funds.lock(t);
    permissions.require("buyer:budget:read");
    var chosen = FundingAllocationPolicy.requireTotal(shares(lines), amount);
    var own = cash.current(t, id);
    for (var l : chosen) {
      var sourceFund = funds.fund(t, l.fundId());
      if (sourceFund != null)
        scopes.requireRecordAccess(sourceFund.departmentId(), sourceFund.createdBy());
      var balance =
          funds.balances(t, basis.projectId()).stream()
              .filter(b -> b.fundId().equals(l.fundId()))
              .findFirst()
              .orElseThrow(() -> new IllegalArgumentException("来源不属于已批准项目资金方案"));
      var allowed =
          "payment".equals(kind)
              ? balance.remainingAmount()
              : basis.original().stream()
                  .filter(o -> o.source().equals(source) && o.fundId().equals(l.fundId()))
                  .map(Original::amount)
                  .reduce(BigDecimal.ZERO, BigDecimal::add)
                  .add(
                      own.stream()
                          .filter(o -> o.source().equals(source) && o.fundId().equals(l.fundId()))
                          .map(FundingSettlementMapper.Cash::amount)
                          .reduce(BigDecimal.ZERO, BigDecimal::add));
      if (l.amount().compareTo(allowed) > 0)
        throw new IllegalArgumentException(
            "refund".equals(kind) ? "退款超过该发票在此来源下的已付净额" : "补付超过项目该来源剩余额度");
      cash.insert(
          t,
          evidence,
          basis.projectId(),
          l.fundId(),
          basis.planId(),
          "refund".equals(kind) ? l.amount().negate() : l.amount(),
          actor);
    }
    audit.recordTenantAction(
        t,
        "funding.settlement_cash",
        "purchase_order",
        order,
        evidence + ":" + kind + ":" + source);
  }

  public List<CashEntry> entries(String t, String id) {
    return cash.entries(t, id).stream()
        .map(x -> new CashEntry(x.evidenceId(), x.fundId(), x.code(), x.name(), x.amount()))
        .toList();
  }
}
