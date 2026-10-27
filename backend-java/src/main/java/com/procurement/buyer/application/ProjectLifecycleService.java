package com.procurement.buyer.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.ProjectContracts.Project;
import com.procurement.buyer.api.ProjectLifecycleContracts.*;
import com.procurement.buyer.api.ProjectLifecycleContracts.Record;
import com.procurement.buyer.infrastructure.*;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.math.BigDecimal;
import java.time.Year;
import java.time.ZoneId;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class ProjectLifecycleService {
  @Autowired private FundingService funding;
  @Autowired private FundingCarryoverService fundingCarryover;
  private final ProcurementProjectGuard guard;
  private final ProcurementProjectMapper projects;
  private final ProjectExpansionMapper packages;
  private final ProjectLifecycleMapper mapper;
  private final ProjectAllocationPolicy policy;
  private final BudgetControlService budget;
  private final AuditLogApplicationService audit;
  @Autowired @Lazy private UnifiedWorkflowApplicationService workflow;
  @Autowired @Lazy private ProjectExpansionService expansion;

  @Autowired @Lazy
  private com.procurement.sourcing.application.ProcurementExecutionApplicationService execution;

  public ProjectLifecycleService(
      ProcurementProjectGuard guard,
      ProcurementProjectMapper projects,
      ProjectExpansionMapper packages,
      ProjectLifecycleMapper mapper,
      ProjectAllocationPolicy policy,
      BudgetControlService budget,
      AuditLogApplicationService audit) {
    this.guard = guard;
    this.projects = projects;
    this.packages = packages;
    this.mapper = mapper;
    this.policy = policy;
    this.budget = budget;
    this.audit = audit;
  }

  private String tenant() {
    return TenantAccessGuard.requireTenantId("project lifecycle");
  }

  private String actor() {
    return TenantAccessGuard.requireUserId("project lifecycle");
  }

  public String period(Project p) {
    var y = mapper.period(p.tenantId(), p.id());
    return y == null ? p.period() : y;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Preview preview(String id) {
    return inspect(guard.require(id, false));
  }

  private Preview inspect(Project p) {
    return inspect(p,null);
  }

  private Preview inspect(Project p,String ownWorkflow) {
    var sources = mapper.sources(p.tenantId(), p.id());
    var frozenYears = mapper.frozenYears(p.tenantId(), p.id());
    var carry = new ArrayList<String>();
    var clear = new ArrayList<String>();
    if(funding.hasFunding(p.tenantId(),p.id()))clear.add("专项资金项目终止清算暂未开放，请保留原资金责任，不直接抹去来源归属");
    if(mapper.orderSettlements(p.tenantId(),p.id())>0)carry.add("项目存在合同清算责任或退款调整，请先完成当前年度清算；不自动重写跨年度历史支出");
    var paidEntries = mapper.paidEntries(p.tenantId(), p.id());
    boolean known = sources.stream().allMatch(s -> s.paidAmount() != null);
    var paid =
        known
            ? sources.stream().map(Source::paidAmount).reduce(BigDecimal.ZERO, BigDecimal::add)
            : null;
    if (mapper.invalidPayments(p.tenantId(), p.id()) > 0
        || paidEntries.stream().anyMatch(e -> e.evidenceNo() == null || e.evidenceNo().isBlank())
        || !known
        || paidEntries.stream()
                .map(PaymentBasis::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .compareTo(paid == null ? BigDecimal.ZERO : paid)
            != 0) {
      carry.add("付款状态、原始流水与预算已支付金额无法一致核验，请先核对，不能推算历史支出");
      known = false;
      paid = null;
    }
    if (mapper.unresolvedAfterSales(p.tenantId(), p.id()) > 0)
      clear.add("存在未结售后或退换货责任：售后单完成不等于实物退回/退款已核验，请先处理，不能直接终止清算");
    if (!"approved".equals(p.status())) {
      carry.add("项目必须处于已批准状态");
      clear.add("项目必须处于已批准状态");
    }
    if (packages.openChanges(p.tenantId(), p.id()) > 0) {
      carry.add("请先完成立项变更");
      clear.add("请先完成立项变更");
    }
    if (projects.demands(p.tenantId(), p.id()).stream().anyMatch(d -> "审批中".equals(d.status()))) {
      carry.add("关联需求仍在审批中");
      clear.add("关联需求仍在审批中");
    }
    if (mapper.mixedSources(p.tenantId(), p.id()) > 0) {
      carry.add("存在跨项目或未归属需求的混合采购，须先核对预算归属");
      clear.add("存在混合采购，不能代其他项目办理清算");
    }
    for (var s : sources) {
      if (!p.departmentId().equals(s.departmentId())
          || s.period().compareTo(period(p)) > 0
          || (s.period().compareTo(period(p)) < 0 && !frozenYears.contains(s.period())))
        carry.add(s.sourceId() + "：预算归属与项目当前承接年度不一致");
      if (s.paidAmount() != null
          && (s.paidAmount().signum() < 0
              || s.paidAmount().compareTo(s.committed()) > 0
              || s.paidAmount().compareTo(s.orderAmount()) > 0))
        carry.add(s.sourceId() + "：已付款超过订单或责任金额，请先核对");
      if (s.period().compareTo(period(p)) < 0
          && (s.paidAmount() == null
              || s.pending().signum() != 0
              || s.committed().compareTo(s.paidAmount()) != 0
              || s.orderAmount().compareTo(s.paidAmount()) != 0))
        carry.add(s.sourceId() + "：历史年度存在尚未承接的责任，须先核对逐年分摊");
    }
    boolean hasOrders = false;
    var seen = new HashSet<String>();
    for (var run : expansion.activeRuns(p)) {
      expansion.requireRun(run, false);
      var rfq = expansion.rfq(run);
      if (rfq == null) {
        clear.add(run.executionId() + "：有效采购尚未形成订单，请先在原业务停止采购");
        continue;
      }
      if (!seen.add(rfq)) continue;
      if (packages.rfqOrders(p.tenantId(), rfq) == 0) {
        clear.add(rfq + "：请先终止无订单采购及对应分包");
        continue;
      }
      if (sources.stream().noneMatch(s -> "rfq".equals(s.sourceType()) && rfq.equals(s.sourceId())))
        carry.add(rfq + "：已有订单的需求预算归属无法核验，请先补齐原始关联");
      hasOrders = true;
      var view = execution.projectView(rfq);
      // The pending carryover itself blocks archive, but is not a change in its submitted evidence.
      for (var b : view.blockers()) if(!b.equals("专项资金跨年承接审批中，暂不能归档")
          && !(ownWorkflow!=null&&b.equals("存在未完成审批："+ownWorkflow)))clear.add(rfq + "：" + b);
    }
    if (!hasOrders) clear.add("没有已有订单，请使用无订单终止入口");
    for (var lot : packages.packages(p.tenantId(), p.id()))
      if (!List.of("closed", "cancelled").contains(lot.status()))
        clear.add(lot.title() + "：请先完成分包结项或无订单终止，不能直接抹去未履行责任");
    var covered = new HashSet<>(policy.legacyDemands(p));
    for (var lot : packages.packages(p.tenantId(), p.id()))
      covered.addAll(packages.lotDemands(p.tenantId(), lot.id()));
    if (projects.demands(p.tenantId(), p.id()).stream()
        .anyMatch(d -> !"已取消".equals(d.status()) && !covered.contains(d.id())))
      clear.add("存在未纳入已结清采购执行的需求，请先终止或完成该需求");
    var amount =
        sources.stream()
            .map(s -> s.pending().add(s.committed()))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    return new Preview(
        p.period(),
        period(p),
        amount,
        paid,
        known ? amount.subtract(paid) : null,
        paidEntries,
        sources,
        carry.stream().distinct().toList(),
        clear.stream().distinct().toList(),funding.hasFunding(p.tenantId(),p.id()));
  }

  private void acceptable(Preview v, String kind) {
    var blockers = "carryover".equals(kind) ? v.carryoverBlockers() : v.liquidationBlockers();
    if (!blockers.isEmpty()) throw new IllegalStateException(String.join("；", blockers));
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Page history(String project, int page, int size) {
    guard.require(project, false);
    if (page < 1 || size < 1 || size > 100) throw new IllegalArgumentException("分页参数不合法");
    return new Page(
        mapper.page(tenant(), project, size, (long) (page - 1) * size),
        mapper.count(tenant(), project),
        page,
        size);
  }

  @Transactional
  public Record submit(String project, Request r) {
    guard.lock();
    var p = guard.require(project, true);
    mapper.lockOrders(tenant(), project);
    if (p.revision() != r.revision()) throw new IllegalStateException("项目已变化，请刷新");
    if (mapper.pending(tenant(), project) > 0)
      throw new IllegalStateException("已有跨年度承接或清算审批，请勿重复提交");
    if (!List.of("carryover", "liquidation").contains(r.kind()))
      throw new IllegalArgumentException("业务类型无效");
    if("liquidation".equals(r.kind()))funding.requireUnfundedProject(tenant(),project);
    var v = inspect(p);
    acceptable(v, r.kind());
    String target = period(p);
    if ("carryover".equals(r.kind())) {
      target = r.targetPeriod();
      var current = Year.now(ZoneId.of("Asia/Shanghai")).toString();
      if (target == null
          || !target.matches("20[0-9]{2}")
          || target.compareTo(period(p)) <= 0
          || target.compareTo(current) < 0)
        throw new IllegalArgumentException("承接年度须晚于当前责任年度，且不得早于本年度");
    } else if (r.targetPeriod() != null && !target.equals(r.targetPeriod()))
      throw new IllegalArgumentException("清算不能修改年度");
    var snapshot = new LinkedHashMap<String, Object>();
    snapshot.put("projectId", project);
    snapshot.put("title", p.title());
    snapshot.put("reason", r.reason());
    snapshot.put("project", policy.definition(p));
    snapshot.put("preview", v);
    snapshot.put("paidEntryIds", v.payments().stream().map(PaymentBasis::id).toList());
    snapshot.put("packages", expansion.packages(project));
    if("carryover".equals(r.kind()))snapshot.put("fundingCarryover",fundingCarryover.prepare(p,target,r.fundingSources(),v.paidAmount(),true));
    else if(r.fundingSources()!=null&&!r.fundingSources().isEmpty())throw new IllegalArgumentException("清算不能提交资金承接映射");
    if ("liquidation".equals(r.kind())) snapshot.put("execution", expansion.summary(project));
    String id = "project-lifecycle-" + UUID.randomUUID();
    mapper.insert(
        id,
        tenant(),
        project,
        r.kind(),
        period(p),
        target,
        p.revision(),
        r.reason(),
        policy.write(snapshot),
        v.amount(),
        actor());
    var start =
        workflow.start(
            new WorkflowStartCommand(
                "project_" + r.kind(),
                id,
                p.departmentId(),
                v.amount().max(p.plannedAmount()),
                r.formData() == null ? Map.of() : r.formData(),
                snapshot));
    if (mapper.bind(tenant(), id, start.workflowInstanceId()) != 1)
      throw new IllegalStateException("流程绑定失败");
    audit.recordTenantAction(
        tenant(),
        "project." + r.kind() + "_submitted",
        "procurement_project",
        project,
        id + ":" + r.reason());
    return mapper.find(tenant(), id);
  }

  @Transactional
  public Record withdraw(String project, String id, int revision, String reason) {
    guard.lock();
    guard.require(project, true);
    var r = mapper.find(tenant(), id);
    if (r == null || !project.equals(r.projectId())) throw new IllegalArgumentException("申请不存在");
    if (r.revision() != revision) throw new IllegalStateException("申请已变化，请刷新");
    workflow.withdrawProcurementProject(r.workflowInstanceId(), reason);
    return mapper.find(tenant(), id);
  }

  public Record validate(WorkflowBusinessInstance i, boolean approved) {
    // Match submission lock order before Flowable takes task-row locks.
    budget.lock(i.tenantId());
    projects.lock(i.tenantId());
    var r = mapper.find(i.tenantId(), i.businessId());
    if (r == null
        || !"submitted".equals(r.status())
        || !i.id().equals(r.workflowInstanceId())
        || !("project_" + r.kind()).equals(i.businessType()))
      throw new IllegalStateException("申请不在对应审批中");
    var p = projects.find(i.tenantId(), r.projectId());
    mapper.lockOrders(i.tenantId(), r.projectId());
    if(approved&&"liquidation".equals(r.kind()))funding.requireUnfundedProject(i.tenantId(),r.projectId());
    if (approved) {
      if (p.revision() != r.projectRevision() || !period(p).equals(r.sourcePeriod()))
        throw new IllegalStateException("项目或承接年度已变化，请驳回后重提");
      var now = inspect(p,i.id());
      acceptable(now, r.kind());
      var old = policy.tree(r.snapshot()).path("preview");
      if (!old.equals(policy.tree(policy.write(now))))
        throw new IllegalStateException("履约或资金数据已变化，请驳回后重新核对清算/承接依据");
      if("carryover".equals(r.kind()))fundingCarryover.validate(p,r,now.paidAmount());
      if ("liquidation".equals(r.kind())
          && !policy
              .tree(r.snapshot())
              .path("execution")
              .equals(policy.tree(policy.write(expansion.summary(p.id())))))
        throw new IllegalStateException("清算单据已变化，请驳回后重新提交");
    }
    return r;
  }

  public void complete(WorkflowBusinessInstance i, WorkflowCompletion c) {
    var r = validate(i, c.approved());
    if (mapper.finish(
            i.tenantId(), r.id(), r.revision(), c.approved() ? "approved" : "rejected", c.actorId())
        != 1) throw new IllegalStateException("申请状态已变化");
    if (c.approved()) {
      var p = projects.find(i.tenantId(), r.projectId());
      if ("carryover".equals(r.kind())) {
        budget.checkProjectCarryover(i.tenantId(), p.departmentId(), r.targetPeriod(), r.id());
        fundingCarryover.publish(i,c,r);
      } else {
        for (var run : expansion.activeRuns(p)) {
          var rfq = expansion.rfq(run);
          if (rfq != null) execution.archiveProject(rfq, "终止清算:" + r.reason());
        }
      }
      if (projects.state(
              i.tenantId(),
              p.id(),
              p.revision(),
              "liquidation".equals(r.kind()) ? "terminated" : p.status(),
              null,
              r.reason())
          != 1) throw new IllegalStateException("项目已变化");
    }
    audit.recordTenantAction(
        i.tenantId(),
        "project." + r.kind() + "_" + (c.approved() ? "approved" : "rejected"),
        "procurement_project",
        r.projectId(),
        r.id() + ":" + c.comment());
  }

  public void cancel(WorkflowBusinessInstance i, String actor) {
    var r = validate(i, false);
    if (mapper.finish(i.tenantId(), r.id(), r.revision(), "withdrawn", actor) != 1)
      throw new IllegalStateException("申请已变化");
  }
}
