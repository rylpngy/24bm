package com.procurement.buyer.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.FundingCarryoverContracts.*;
import com.procurement.buyer.api.FundingContracts.Change;
import com.procurement.buyer.api.ProjectContracts.Project;
import com.procurement.buyer.api.ProjectLifecycleContracts.Record;
import com.procurement.buyer.infrastructure.FundingMapper;
import com.procurement.buyer.infrastructure.ProjectLifecycleMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class FundingCarryoverService {
  private final FundingMapper funds;
  private final ProjectLifecycleMapper lifecycle;
  private final ProcurementProjectGuard guard;
  private final DataScopeService scopes;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;
  private final ObjectMapper json;

  public FundingCarryoverService(
      FundingMapper funds,
      ProjectLifecycleMapper lifecycle,
      ProcurementProjectGuard guard,
      DataScopeService scopes,
      PermissionService permissions,
      AuditLogApplicationService audit,
      ObjectMapper json) {
    this.funds = funds;
    this.lifecycle = lifecycle;
    this.guard = guard;
    this.scopes = scopes;
    this.permissions = permissions;
    this.audit = audit;
    this.json = json;
  }

  public String period(Project p) {
    return Objects.requireNonNullElse(lifecycle.period(p.tenantId(), p.id()), p.period());
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Options options(String project, String target) {
    permissions.require("buyer:budget:read");
    var p = guard.require(project, false);
    if (target == null || !target.matches("20[0-9]{2}"))
      throw new IllegalArgumentException("请选择四位目标年度");
    var sources = funds.balances(p.tenantId(), p.id());
    if (sources.isEmpty())
      return new Options(false, period(p), BigDecimal.ZERO, List.of(), List.of());
    var scope = scopes.currentUserDataScope();
    var choices =
        funds.choices(p.tenantId(), p.departmentId(), target).stream()
            .filter(
                f ->
                    !scope.restricted()
                        || (scope.requesterId() != null
                            ? scope.requesterId().equals(f.createdBy())
                            : scope.departmentIds().contains(f.departmentId())))
            .toList();
    return new Options(true, period(p), funds.totalPaid(p.tenantId(), p.id()), sources, choices);
  }

  /**
   * Called under project and order locks; source balances and target limits share the funding
   * mutex.
   */
  public Snapshot prepare(
      Project p, String target, List<Mapping> mappings, BigDecimal verifiedPaid, boolean access) {
    funds.lock(p.tenantId());
    var sources = funds.balances(p.tenantId(), p.id());
    if (sources.isEmpty()) {
      if (mappings != null && !mappings.isEmpty())
        throw new IllegalArgumentException("项目未启用专项资金，不应提交资金承接映射");
      if (funds.pending(p.tenantId(), null, p.id()) > 0)
        throw new IllegalStateException("专项资金分摊审批中，请先完成或撤回");
      return null;
    }
    if (access) permissions.require("buyer:budget:manage");
    if (funds.pending(p.tenantId(), null, p.id()) > 0)
      throw new IllegalStateException("专项资金分摊审批中，暂不能承接");
    if (target == null || !target.matches("20[0-9]{2}") || target.compareTo(period(p)) <= 0)
      throw new IllegalArgumentException("专项资金承接年度须晚于当前责任年度");
    BigDecimal prior = funds.priorPaid(p.tenantId(), p.id()),
        paid = funds.totalPaid(p.tenantId(), p.id());
    if (verifiedPaid == null
        || paid.compareTo(verifiedPaid) != 0
        || sources.stream().map(s -> s.paidAmount()).reduce(prior, BigDecimal::add).compareTo(paid)
            != 0
        || sources.stream()
                .map(s -> s.allocatedAmount())
                .reduce(prior, BigDecimal::add)
                .compareTo(p.plannedAmount())
            != 0) throw new IllegalStateException("专项资金归属与项目实际付款、批准金额无法一致核验");
    var needed = sources.stream().filter(s -> s.remainingAmount().signum() > 0).toList();
    if (needed.isEmpty()) throw new IllegalStateException("专项资金责任已全部支付，无需跨年度承接");
    if (mappings == null || mappings.size() != needed.size())
      throw new IllegalArgumentException("请为每个尚有未付余额的原专项资金来源选择目标来源");
    Map<String, String> selected = new HashMap<>();
    for (var m : mappings)
      if (m == null
          || m.sourceFundId() == null
          || m.targetFundId() == null
          || selected.putIfAbsent(m.sourceFundId(), m.targetFundId()) != null)
        throw new IllegalArgumentException("原资金来源不能重复或为空");
    var lines = new ArrayList<Line>();
    Map<String, BigDecimal> totals = new TreeMap<>();
    for (var s : needed) {
      var old = funds.fund(p.tenantId(), s.fundId());
      var id = selected.remove(s.fundId());
      var to = id == null ? null : funds.fund(p.tenantId(), id);
      if (old == null || !old.period().equals(period(p)))
        throw new IllegalStateException("原资金来源年度与当前责任年度不符");
      if (to == null
          || !"approved".equals(to.status())
          || !to.period().equals(target)
          || !to.departmentId().equals(p.departmentId()))
        throw new IllegalArgumentException("请选择同部门、目标年度的已批准资金来源");
      if (access) {
        scopes.requireRecordAccess(old.departmentId(), old.createdBy());
        scopes.requireRecordAccess(to.departmentId(), to.createdBy());
      }
      totals.merge(to.id(), s.remainingAmount(), BigDecimal::add);
      lines.add(
          new Line(
              old.id(),
              old.code(),
              old.name(),
              s.allocatedAmount(),
              s.paidAmount(),
              to.id(),
              to.code(),
              to.name(),
              to.revision(),
              s.remainingAmount()));
    }
    if (!selected.isEmpty()) throw new IllegalArgumentException("资金映射包含无未付责任的来源");
    for (var e : totals.entrySet())
      if (e.getValue().compareTo(funds.fund(p.tenantId(), e.getKey()).availableAmount()) > 0)
        throw new IllegalStateException("目标专项资金额度不足，请先批准目标额度，不自动修改或挪用其他来源");
    return new Snapshot(
        p.id(), funds.plan(p.tenantId(), p.id()), period(p), target, paid, List.copyOf(lines));
  }

  public Snapshot read(String snapshot) {
    try {
      var node = json.readTree(snapshot).path("fundingCarryover");
      return node.isMissingNode() || node.isNull() ? null : json.treeToValue(node, Snapshot.class);
    } catch (Exception e) {
      throw new IllegalStateException("专项资金承接依据读取失败", e);
    }
  }

  public void validate(Project p, Record r, BigDecimal verifiedPaid) {
    var old = read(r.snapshot());
    var current =
        prepare(
            p,
            r.targetPeriod(),
            old == null
                ? null
                : old.lines().stream()
                    .map(l -> new Mapping(l.sourceFundId(), l.targetFundId()))
                    .toList(),
            verifiedPaid,
            false);
    if (!json.valueToTree(old).equals(json.valueToTree(current)))
      throw new IllegalStateException("专项资金来源、付款或目标版本已变化，请驳回后重提");
  }

  public void publish(WorkflowBusinessInstance instance, WorkflowCompletion completion, Record r) {
    var snapshot = read(r.snapshot());
    if (snapshot == null) return;
    String t = instance.tenantId(), id = r.id();
    var total =
        snapshot.lines().stream().map(Line::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    // This is evidence derived from the real project carryover approval, not a second simulated
    // workflow.
    funds.insert(
        new Change(
            id,
            t,
            "project_carryover",
            null,
            r.projectId(),
            instance.departmentId(),
            r.targetPeriod(),
            r.projectRevision(),
            total,
            "carryover:" + id,
            write(snapshot),
            write(snapshot),
            r.reason(),
            "submitted",
            1,
            null,
            instance.initiatorId(),
            null,
            null,
            null));
    if (funds.bind(t, id, instance.id()) != 1
        || funds.finish(t, id, 1, "approved", completion.actorId()) != 1)
      throw new IllegalStateException("专项资金承接审批证据绑定失败");
    Map<String, BigDecimal> totals = new TreeMap<>();
    snapshot.lines().forEach(l -> totals.merge(l.targetFundId(), l.amount(), BigDecimal::add));
    totals.forEach((fund, amount) -> funds.line(t, id, r.projectId(), fund, amount));
    funds.publish(t, r.projectId(), id);
    if (funds.carryPaidBasis(t, r.projectId(), snapshot.paidBasis()) != 1)
      throw new IllegalStateException("专项资金历史付款基线保存失败");
    audit.recordTenantAction(
        t,
        "funding.carried_over",
        "procurement_project",
        r.projectId(),
        id + ":" + write(snapshot));
  }

  private String write(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("专项资金承接依据序列化失败", e);
    }
  }
}
