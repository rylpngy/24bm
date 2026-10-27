package com.procurement.buyer.application;

import com.procurement.buyer.api.FundingContracts.*;
import com.procurement.buyer.infrastructure.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public record FundingReallocationService(
    FundingMapper funds,
    FundingReallocationMapper allocations,
    ProcurementProjectMapper projects,
    ProjectLifecycleMapper lifecycle) {
  public record Line(
      String fundId,
      String code,
      String name,
      BigDecimal beforeAmount,
      BigDecimal paidAmount,
      BigDecimal afterAmount,
      int fundRevision) {}

  public record Basis(String planId, String period, BigDecimal priorPaidAmount, List<Line> lines) {}

  public String blocker(String t, String p) {
    var project = projects.find(t, p);
    if (project == null || !"approved".equals(project.status())) return "项目须为已批准且未结项状态";
    if (funds.plan(t, p) == null || funds.paymentHistory(t, p) == 0) return "仅适用于已有专项分摊及真实付款历史的项目";
    if (allocations.conflicts(t, p) > 0 || funds.pendingCorrection(t, p) > 0)
      return "存在立项变更、承接、更正或清算，请先处理";
    return "";
  }

  public Basis prepare(String t, Request r) {
    String blocker = blocker(t, r.projectId());
    if (!blocker.isBlank()) throw new IllegalStateException(blocker);
    var project = projects.find(t, r.projectId());
    if (project.revision() != r.revision()) throw new IllegalStateException("项目版本已变化");
    if (r.fundId() != null || r.lines() == null || r.lines().isEmpty())
      throw new IllegalArgumentException("请明确填写当前来源的调整后责任金额");
    var balances = funds.balances(t, r.projectId());
    var total =
        balances.stream().map(Balance::allocatedAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    if (total.add(funds.priorPaid(t, r.projectId())).compareTo(project.plannedAmount()) != 0
        || r.amount().compareTo(total) != 0)
      throw new IllegalArgumentException("调整后总额须等于当前年度责任，不得改变历史已付基线或项目金额");
    Map<String, BigDecimal> requested = new HashMap<>();
    for (var l : r.lines())
      if (l == null
          || l.fundId() == null
          || l.amount() == null
          || l.amount().signum() < 0
          || l.amount().scale() > 2
          || requested.putIfAbsent(l.fundId(), l.amount()) != null)
        throw new IllegalArgumentException("来源不得重复，金额须为非负两位小数");
    String period =
        Objects.requireNonNullElse(lifecycle.period(t, r.projectId()), project.period());
    var lines = new ArrayList<Line>();
    boolean changed = false;
    for (var b : balances) {
      var amount = requested.remove(b.fundId());
      if (amount == null) amount = BigDecimal.ZERO;
      var f = funds.fund(t, b.fundId());
      if (f == null
          || !f.departmentId().equals(project.departmentId())
          || !f.period().equals(period)
          || !"approved".equals(f.status()))
        throw new IllegalArgumentException("来源须为项目现有同部门、当前年度已批准资金");
      if (amount.compareTo(b.paidAmount()) < 0)
        throw new IllegalArgumentException(f.name() + "：调整后责任不能低于该来源已付金额");
      if (amount.subtract(b.allocatedAmount()).compareTo(f.availableAmount()) > 0)
        throw new IllegalStateException(f.name() + "：专项资金额度不足");
      if (amount.compareTo(b.allocatedAmount()) != 0) changed = true;
      lines.add(
          new Line(
              f.id(),
              f.code(),
              f.name(),
              b.allocatedAmount(),
              b.paidAmount(),
              amount,
              f.revision()));
    }
    if (!requested.isEmpty()) throw new IllegalArgumentException("只能调整项目当前版本内的来源，不能新增或替换历史资金来源");
    if (lines.stream()
            .map(Line::afterAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .compareTo(total)
        != 0) throw new IllegalArgumentException("调整前后资金责任总额必须相等");
    if (!changed) throw new IllegalArgumentException("资金责任金额未变化");
    return new Basis(
        funds.plan(t, r.projectId()),
        period,
        funds.priorPaid(t, r.projectId()),
        List.copyOf(lines));
  }

  public void apply(String t, String c, String p, Basis basis, String actor) {
    for (var l : basis.lines())
      allocations.line(
          t, c, p, basis.planId(), l.fundId(), l.beforeAmount(), l.afterAmount(), actor);
  }
}
