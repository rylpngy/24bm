package com.procurement.buyer.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.FundingContracts.Change;
import com.procurement.buyer.api.ProjectContracts.Project;
import com.procurement.buyer.api.ProjectLifecycleContracts.Record;
import com.procurement.buyer.infrastructure.FundingMapper;
import com.procurement.identity.application.*;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public record FundingLiquidationService(
    FundingMapper funds,
    FundingCarryoverService carryover,
    PermissionService permissions,
    DataScopeService scopes,
    AuditLogApplicationService audit,
    ObjectMapper json) {
  public record Line(
      String fundId,
      String code,
      String name,
      int fundRevision,
      BigDecimal allocatedAmount,
      BigDecimal paidAmount,
      BigDecimal releasedAmount) {}

  public record Basis(
      String projectId,
      String planId,
      String period,
      BigDecimal historicalPaid,
      BigDecimal totalPaid,
      BigDecimal releasedAmount,
      List<Line> lines) {}

  public Basis inspect(Project p, BigDecimal verifiedPaid) {
    var balances = funds.balances(p.tenantId(), p.id());
    if (balances.isEmpty()) {
      if (funds.pending(p.tenantId(), null, p.id()) > 0)
        throw new IllegalStateException("专项资金审批中，暂不能终止清算");
      return null;
    }
    if (funds.pending(p.tenantId(), null, p.id()) > 0
        || funds.pendingCorrection(p.tenantId(), p.id()) > 0)
      throw new IllegalStateException("专项分摊、调整或更正审批中，须先完成或撤回");
    var prior = funds.priorPaid(p.tenantId(), p.id());
    var paid = funds.totalPaid(p.tenantId(), p.id());
    if (verifiedPaid == null
        || paid.compareTo(verifiedPaid) != 0
        || balances.stream().map(b -> b.paidAmount()).reduce(prior, BigDecimal::add).compareTo(paid)
            != 0
        || balances.stream()
                .map(b -> b.allocatedAmount())
                .reduce(prior, BigDecimal::add)
                .compareTo(p.plannedAmount())
            != 0) throw new IllegalStateException("专项来源、历史已付与项目实际净付或批准金额不一致，不能推算释放");
    var plan = funds.change(p.tenantId(), funds.plan(p.tenantId(), p.id()));
    if (plan == null || !"approved".equals(plan.status()))
      throw new IllegalStateException("缺少已批准专项资金方案");
    var lines = new ArrayList<Line>();
    for (var b : balances) {
      var f = funds.fund(p.tenantId(), b.fundId());
      if (f == null
          || !f.departmentId().equals(p.departmentId())
          || !f.period().equals(carryover.period(p))
          || !"approved".equals(f.status())
          || b.paidAmount().signum() < 0
          || b.remainingAmount().signum() < 0)
        throw new IllegalStateException("专项来源年度、部门或责任金额无法核验");
      lines.add(
          new Line(
              f.id(),
              f.code(),
              f.name(),
              f.revision(),
              b.allocatedAmount(),
              b.paidAmount(),
              b.remainingAmount()));
    }
    var release = lines.stream().map(Line::releasedAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    return new Basis(
        p.id(), plan.id(), carryover.period(p), prior, paid, release, List.copyOf(lines));
  }

  public Basis prepare(Project p, BigDecimal paid) {
    funds.lock(p.tenantId());
    var basis = inspect(p, paid);
    if (basis == null) return null;
    permissions.require("buyer:budget:manage");
    for (var l : basis.lines()) {
      var f = funds.fund(p.tenantId(), l.fundId());
      scopes.requireRecordAccess(f.departmentId(), f.createdBy());
    }
    return basis;
  }

  public Basis read(String snapshot) {
    try {
      var v = json.readTree(snapshot).path("fundingLiquidation");
      return v.isMissingNode() || v.isNull() ? null : json.treeToValue(v, Basis.class);
    } catch (Exception e) {
      throw new IllegalStateException("专项终止清算依据读取失败", e);
    }
  }

  public void validate(Project p, Record r, BigDecimal paid) {
    funds.lock(p.tenantId());
    if (!json.valueToTree(read(r.snapshot())).equals(json.valueToTree(inspect(p, paid))))
      throw new IllegalStateException("专项来源、金额或版本已变化，请驳回后重新核验");
  }

  public void publish(WorkflowBusinessInstance i, WorkflowCompletion c, Record r) {
    var basis = read(r.snapshot());
    if (basis == null) return;
    funds.insert(
        new Change(
            r.id(),
            i.tenantId(),
            "project_liquidation",
            null,
            r.projectId(),
            i.departmentId(),
            r.sourcePeriod(),
            r.projectRevision(),
            basis.releasedAmount(),
            "liquidation:" + r.id(),
            write(basis),
            write(basis),
            r.reason(),
            "submitted",
            1,
            null,
            i.initiatorId(),
            null,
            null,
            null));
    if (funds.bind(i.tenantId(), r.id(), i.id()) != 1
        || funds.finish(i.tenantId(), r.id(), 1, "approved", c.actorId()) != 1)
      throw new IllegalStateException("专项清算审批证据绑定失败");
    audit.recordTenantAction(
        i.tenantId(),
        "funding.project_liquidated",
        "procurement_project",
        r.projectId(),
        r.id() + ":" + write(basis));
  }

  private String write(Object o) {
    try {
      return json.writeValueAsString(o);
    } catch (Exception e) {
      throw new IllegalStateException("专项清算依据保存失败", e);
    }
  }
}
