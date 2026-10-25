package com.procurement.buyer.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.ProjectContracts.*;
import com.procurement.buyer.api.ProjectExpansionContracts.*;
import com.procurement.buyer.infrastructure.*;
import com.procurement.common.tenant.*;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.identity.application.*;
import com.procurement.sourcing.application.*;
import com.procurement.tender.application.TenderApplicationService;
import com.procurement.workflow.application.*;
import java.math.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class ProjectExpansionService {
  private final ProcurementProjectMapper projects;
  private final ProjectExpansionMapper mapper;
  private final ProcurementProjectGuard guard;
  private final ProjectAllocationPolicy policy;
  private final ProjectPlanSupport plans;
  private final PermissionService permissions;
  private final DataScopeService scopes;
  private final AuditLogApplicationService audit;
  private final PurchaseDemandApplicationService demands;
  private final RfqApplicationService rfqs;
  private final TenderApplicationService tenders;
  private final ProcurementExecutionApplicationService execution;
  private final UnifiedWorkflowApplicationService workflow;

  public ProjectExpansionService(
      ProcurementProjectMapper projects,
      ProjectExpansionMapper mapper,
      ProcurementProjectGuard guard,
      ProjectAllocationPolicy policy,
      ProjectPlanSupport plans,
      PermissionService permissions,
      DataScopeService scopes,
      AuditLogApplicationService audit,
      PurchaseDemandApplicationService demands,
      RfqApplicationService rfqs,
      TenderApplicationService tenders,
      ProcurementExecutionApplicationService execution,
      UnifiedWorkflowApplicationService workflow) {
    this.projects = projects;
    this.mapper = mapper;
    this.guard = guard;
    this.policy = policy;
    this.plans = plans;
    this.permissions = permissions;
    this.scopes = scopes;
    this.audit = audit;
    this.demands = demands;
    this.rfqs = rfqs;
    this.tenders = tenders;
    this.execution = execution;
    this.workflow = workflow;
  }

  private String t() {
    return TenantAccessGuard.requireTenantId("project packages");
  }

  private String actor() {
    return TenantAccessGuard.requireUserId("project packages");
  }

  private void revision(int actual, int expected) {
    if (actual != expected) throw new IllegalStateException("记录已变化，请刷新后重试");
  }

  private Project mutable(String id) {
    var p = guard.require(id, true);
    guard.approved(p);
    policy.noPending(p);
    return p;
  }

  private void bump(Project p) {
    if (projects.state(t(), p.id(), p.revision(), p.status(), null, p.closeoutReason()) != 1)
      throw new IllegalStateException("项目已变化");
  }

  private void event(String id, String action, String reason) {
    audit.recordTenantAction(t(), "project." + action, "procurement_project", id, reason);
  }

  public void requireLegacyMode(Project p) {
    policy.noPending(p);
    if (!mapper.packages(t(), p.id()).isEmpty())
      throw new IllegalStateException("请进入具体分包关联需求及下发采购");
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public List<Balance> balances(String project) {
    var p = guard.require(project, false);
    var used = policy.protectedQuantity(p, null);
    return projects.lines(t(), project).stream()
        .map(
            l -> {
              var allocated = used.getOrDefault(l.materialId(), BigDecimal.ZERO);
              return new Balance(
                  l.materialId(), l.quantity(), allocated, l.quantity().subtract(allocated));
            })
        .toList();
  }

  public boolean hasOpenWork(String id) {
    return mapper.openChanges(t(), id) > 0
        || mapper.packages(t(), id).stream().anyMatch(l -> !"cancelled".equals(l.status()));
  }

  public List<Run> activeRuns(Project p) {
    var result = new ArrayList<Run>();
    if (p.executionId() != null)
      result.add(
          new Run(
              "legacy",
              t(),
              p.id(),
              null,
              p.executionType(),
              p.executionId(),
              "active",
              "原采购执行",
              p.createdBy(),
              p.createdAt()));
    for (var lot : mapper.packages(t(), p.id()))
      if (!"cancelled".equals(lot.status()))
        result.addAll(
            mapper.runs(t(), lot.id()).stream().filter(r -> "active".equals(r.status())).toList());
    return result;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Execution summary(String project) {
    var p = guard.require(project, false);
    permissions.require("buyer:demand:read");
    var ds = projects.demands(t(), project);
    for (var d : ds) scopes.requireRecordAccess(d.departmentId(), d.requesterId());
    var docs = new LinkedHashMap<String, Trace>();
    for (var d : projects.demandTrace(t(), project)) docs.put(d.module() + ":" + d.recordId(), d);
    var warnings = new ArrayList<String>();
    BigDecimal order = BigDecimal.ZERO, invoiced = BigDecimal.ZERO, paid = BigDecimal.ZERO;
    boolean canClose = true;
    var runs = activeRuns(p);
    if (runs.isEmpty()) {
      warnings.add("尚无有效采购执行");
      canClose = false;
    }
    if (mapper.openChanges(t(), project) > 0) {
      warnings.add("存在未完成的立项变更，请先处理");
      canClose = false;
    }
    for (var lot : mapper.packages(t(), project))
      if (!"cancelled".equals(lot.status())
          && mapper.runs(t(), lot.id()).stream().noneMatch(r -> "active".equals(r.status()))) {
        warnings.add(lot.title() + "：尚未下发有效采购执行");
        canClose = false;
      }
    var covered = new HashSet<>(policy.legacyDemands(p));
    for (var lot : mapper.packages(t(), project)) covered.addAll(mapper.lotDemands(t(), lot.id()));
    if (ds.stream().anyMatch(d -> !"已取消".equals(d.status()) && !covered.contains(d.id()))) {
      warnings.add("仍有需求未分配到采购执行，请先纳入分包");
      canClose = false;
    }
    var qty = policy.protectedQuantity(p, null);
    if (projects.lines(t(), project).stream()
        .anyMatch(
            l -> l.quantity().compareTo(qty.getOrDefault(l.materialId(), BigDecimal.ZERO)) > 0)) {
      warnings.add("仍有已批准明细未分包或下发，请补齐分包或审批变更后结项");
      canClose = false;
    }
    for (var run : runs) {
      requireRun(run, false);
      if ("tender".equals(run.executionType())) {
        var row = projects.tenderTrace(t(), run.executionId());
        docs.put(row.module() + ":" + row.recordId(), row);
      }
      String rfq = rfq(run);
      if (rfq == null) {
        warnings.add(run.executionId() + "：招标尚未转履约订单");
        canClose = false;
        continue;
      }
      var view = execution.projectView(rfq);
      order = order.add(view.orderAmount());
      invoiced = invoiced.add(view.invoicedAmount());
      paid = paid == null || view.paidAmount() == null ? null : paid.add(view.paidAmount());
      if (!view.canArchive()) {
        canClose = false;
        for (String b : view.blockers()) warnings.add(run.executionId() + "：" + b);
      }
      for (var d : view.documents())
        docs.put(
            d.module() + ":" + d.recordId(),
            new Trace(
                d.module(), d.id(), d.title(), d.status(), d.amount(), d.module(), d.recordId()));
    }
    return new Execution(
        ds,
        new ArrayList<>(docs.values()),
        ds.stream()
            .filter(d -> !"已取消".equals(d.status()))
            .map(Demand::budget)
            .reduce(BigDecimal.ZERO, BigDecimal::add),
        order,
        invoiced,
        paid,
        warnings,
        "approved".equals(p.status()) && canClose);
  }

  @Transactional
  public void closeProject(String project, Action a) {
    guard.lock();
    var p = mutable(project);
    revision(p.revision(), a.revision());
    var state = summary(project);
    if (!state.canClose())
      throw new IllegalStateException("项目尚不能结项：" + String.join("；", state.warnings()));
    var archives = new ArrayList<String>();
    for (var run : activeRuns(p)) {
      String rfq = rfq(run);
      if (rfq == null) throw new IllegalStateException("尚无履约锚点");
      archives.add(execution.archiveProject(rfq, a.reason()));
    }
    for (var lot : mapper.packages(t(), project))
      if ("ready".equals(lot.status())) mapper.lotState(t(), lot.id(), lot.revision(), "closed");
    if (projects.state(t(), project, p.revision(), "closed", null, a.reason()) != 1)
      throw new IllegalStateException("项目已变化");
    event(project, "closed", "分包执行归档:" + String.join(",", archives) + ";" + a.reason());
  }

  private PackageRow requireLot(String project, String lot, boolean write) {
    guard.require(project, write);
    var row = mapper.lot(t(), lot);
    if (row == null || !project.equals(row.projectId()))
      throw new IllegalArgumentException("分包不存在");
    return row;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public List<PackageDetail> packages(String project) {
    guard.require(project, false);
    return mapper.packages(t(), project).stream().map(this::detail).toList();
  }

  private PackageDetail detail(PackageRow lot) {
    var ids = mapper.lotDemands(t(), lot.id());
    var ds = new ArrayList<Demand>();
    if (!ids.isEmpty()) permissions.require("buyer:demand:read");
    for (var id : ids) {
      var d = projects.demand(t(), id);
      scopes.requireRecordAccess(d.departmentId(), d.requesterId());
      ds.add(d);
    }
    var runs = mapper.runs(t(), lot.id());
    var statuses = new LinkedHashMap<String, String>();
    var methods = new LinkedHashMap<String, String>();
    for (var run : runs) {
      if (!permissions.currentUserHas("buyer:" + run.executionType() + ":read")) continue;
      try {
        requireRun(run, false);
      } catch (PermissionDeniedException denied) {
        continue;
      }
      String status =
          "rfq".equals(run.executionType())
              ? mapper.rfqStatus(t(), run.executionId())
              : mapper.tenderStatus(t(), run.executionId());
      if (status != null) statuses.put(run.executionId(), status);
      methods.put(run.executionId(), "rfq".equals(run.executionType())
          ? mapper.rfqMethod(t(), run.executionId()) : "招标");
    }
    return new PackageDetail(lot, policy.lines(lot.lines()), ds, runs, statuses, methods);
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Execution packageExecution(String project, String id) {
    var lot = requireLot(project, id, false);
    var d = detail(lot);
    var active = d.runs().stream().filter(r -> "active".equals(r.status())).findFirst();
    var docs = new ArrayList<Trace>();
    for (var demand : d.demands())
      docs.add(
          new Trace(
              "demand",
              demand.id(),
              demand.title(),
              demand.status(),
              demand.budget(),
              "demands",
              demand.id()));
    if (active.isEmpty())
      return new Execution(
          d.demands(),
          docs,
          d.demands().stream().map(Demand::budget).reduce(BigDecimal.ZERO, BigDecimal::add),
          BigDecimal.ZERO,
          BigDecimal.ZERO,
          BigDecimal.ZERO,
          List.of("分包尚未下发有效执行"),
          false);
    var run = active.get();
    requireRun(run, false);
    if ("tender".equals(run.executionType()))
      docs.add(projects.tenderTrace(t(), run.executionId()));
    String rfq = rfq(run);
    if (rfq == null)
      return new Execution(
          d.demands(),
          docs,
          lot.amount(),
          BigDecimal.ZERO,
          BigDecimal.ZERO,
          BigDecimal.ZERO,
          List.of("招标尚未转履约订单"),
          false);
    var view = execution.projectView(rfq);
    docs.removeIf(row -> "demands".equals(row.module()));
    for (var row : view.documents())
      docs.add(
          new Trace(
              row.module(),
              row.id(),
              row.title(),
              row.status(),
              row.amount(),
              row.module(),
              row.recordId()));
    var warnings = new ArrayList<>(view.blockers());
    if (mapper.pending(t(), project) > 0) warnings.add("立项变更审批中，暂不能分包结项");
    return new Execution(
        d.demands(),
        docs,
        d.demands().stream().map(Demand::budget).reduce(BigDecimal.ZERO, BigDecimal::add),
        view.orderAmount(),
        view.invoicedAmount(),
        view.paidAmount(),
        warnings,
        "ready".equals(lot.status()) && warnings.isEmpty());
  }

  @Transactional
  public PackageDetail closePackage(String project, String id, PackageAction a) {
    guard.lock();
    var p = mutable(project);
    var lot = requireLot(project, id, true);
    revision(lot.revision(), a.revision());
    var state = packageExecution(project, id);
    if (!state.canClose())
      throw new IllegalStateException("分包尚不能结项：" + String.join("；", state.warnings()));
    var run =
        mapper.runs(t(), id).stream()
            .filter(r -> "active".equals(r.status()))
            .findFirst()
            .orElseThrow();
    String archive = execution.archiveProject(rfq(run), a.reason());
    mapper.lotState(t(), id, lot.revision(), "closed");
    bump(p);
    event(project, "package_closed", id + ":" + archive + ":" + a.reason());
    return detail(mapper.lot(t(), id));
  }

  private int planVersion(Project p) {
    return mapper.approvedChanges(t(), p.id(), p.revision()).size() + 1;
  }

  private String snapshot(
      Project p, String lot, String title, List<Line> lines, BigDecimal amount) {
    var data = new LinkedHashMap<>(policy.definition(p));
    data.put("projectRevision", p.revision());
    data.put("planVersion", planVersion(p));
    data.put(
        "changeIds",
        mapper.approvedChanges(t(), p.id(), p.revision()).stream().map(Change::id).toList());
    data.put("package", Map.of("id", lot, "title", title, "lines", lines, "amount", amount));
    return policy.write(data);
  }

  @Transactional
  public PackageDetail savePackage(String project, String id, PackageDraft d) {
    guard.lock();
    var p = mutable(project);
    revision(p.revision(), d.projectRevision());
    policy.freezeLegacy(p);
    if (id == null && mapper.packages(t(), project).size() >= 100)
      throw new IllegalStateException("单个项目最多100个分包");
    PackageRow old = id == null ? null : requireLot(project, id, true);
    if (old != null) {
      revision(old.revision(), d.revision());
      if (!List.of("draft", "ready").contains(old.status())
          || !mapper.runs(t(), id).isEmpty()
          || mapper.lotDemands(t(), id).stream()
              .anyMatch(key -> !List.of("草稿", "已驳回").contains(projects.demand(t(), key).status())))
        throw new IllegalStateException("仅未采购且需求已退回重新编制的草稿包可编辑");
    }
    var adopted = d.demandIds() == null ? List.<String>of() : d.demandIds();
    if (new HashSet<>(adopted).size() != adopted.size())
      throw new IllegalArgumentException("需求不能重复选择");
    if (!adopted.isEmpty()) permissions.require("buyer:demand:read");
    for (var demand : adopted) {
      var source = projects.demand(t(), demand);
      if (source == null
          || !project.equals(projects.demandProject(t(), demand))
          || mapper.demandLot(t(), demand) != null
          || policy.legacyDemands(p).contains(demand)
          || projects.activeRfq(t(), demand) > 0)
        throw new IllegalStateException("仅可纳入本项目尚未分包、未采购的关联需求");
      scopes.requireRecordAccess(source.departmentId(), source.requesterId());
      if (!List.of("草稿", "审批中", "已通过", "已驳回").contains(source.status()))
        throw new IllegalStateException("需求状态不能纳入分包");
    }
    var lines = policy.allocate(p, d.lines(), id, adopted);
    String lot = id == null ? "project-package-" + UUID.randomUUID() : id;
    var adoptedQty = new HashMap<String, BigDecimal>();
    BigDecimal adoptedBudget = BigDecimal.ZERO;
    var scopeDemands = new ArrayList<>(adopted);
    if (old != null) scopeDemands.addAll(mapper.lotDemands(t(), id));
    for (var demand : scopeDemands) {
      adoptedBudget = adoptedBudget.add(projects.demand(t(), demand).budget());
      for (var l : policy.tree(mapper.demandLines(t(), demand)))
        adoptedQty.merge(
            l.path("materialId").asText(), l.path("quantity").decimalValue(), BigDecimal::add);
    }
    if (adoptedBudget.compareTo(plans.total(lines)) > 0
        || adoptedQty.entrySet().stream()
            .anyMatch(
                e ->
                    e.getValue()
                            .compareTo(
                                lines.stream()
                                    .filter(l -> l.materialId().equals(e.getKey()))
                                    .map(Line::quantity)
                                    .findFirst()
                                    .orElse(BigDecimal.ZERO))
                        > 0)) throw new IllegalStateException("纳入需求的数量或预算超过分包范围");
    var allocatedAmount = policy.amountFor(p, lines, id, adopted);
    if (adoptedBudget.compareTo(allocatedAmount) > 0)
      throw new IllegalStateException("纳入需求预算超过尾差调整后的分包金额");
    if (old == null)
      mapper.insertLot(
          t(),
          project,
          lot,
          d.title(),
          planVersion(p),
          allocatedAmount,
          policy.write(lines),
          snapshot(p, lot, d.title(), lines, allocatedAmount),
          actor());
    else if (mapper.editLot(
            t(),
            id,
            old.revision(),
            d.title(),
            planVersion(p),
            allocatedAmount,
            policy.write(lines),
            snapshot(p, lot, d.title(), lines, allocatedAmount))
        != 1) throw new IllegalStateException("分包已变化");
    for (var demand : adopted) mapper.link(t(), lot, demand);
    if (!adopted.isEmpty()) {
      var current = mapper.lot(t(), lot);
      mapper.lotState(t(), lot, current.revision(), "ready");
    }
    bump(p);
    event(project, "package_saved", lot + ":" + d.title());
    return detail(mapper.lot(t(), lot));
  }

  @Transactional
  public PackageDetail cancel(String project, String id, PackageAction a) {
    guard.lock();
    var p = mutable(project);
    var lot = requireLot(project, id, true);
    revision(lot.revision(), a.revision());
    if (!"draft".equals(lot.status())
        || !mapper.lotDemands(t(), id).isEmpty()
        || !mapper.runs(t(), id).isEmpty())
      throw new IllegalStateException("仅未关联需求、未采购的草稿包可以取消，已关联业务须保留");
    mapper.lotState(t(), id, lot.revision(), "cancelled");
    bump(p);
    event(project, "package_cancelled", id + ":" + a.reason());
    return detail(mapper.lot(t(), id));
  }

  @Transactional
  public PackageDetail createDemand(String project, String id, PackageAction a) {
    guard.lock();
    var p = mutable(project);
    var lot = requireLot(project, id, true);
    revision(lot.revision(), a.revision());
    if (!"draft".equals(lot.status()) || !mapper.lotDemands(t(), id).isEmpty())
      throw new IllegalStateException("分包已有需求或已取消，不能重复生成");
    if (!p.period().equals(Year.now(ZoneId.of("Asia/Shanghai")).toString()))
      throw new IllegalStateException("仅当前年度分包可生成需求");
    String demand =
        demands.createProjectDemand(
            p.title() + " · " + lot.title(),
            p.departmentId(),
            lot.amount(),
            policy.lines(lot.lines()).stream()
                .map(
                    l ->
                        new PurchaseDemandApplicationService.ProjectLine(
                            l.materialId(), l.quantity()))
                .toList(),
            p.purpose());
    projects.linkDemand(t(), project, demand, actor());
    mapper.link(t(), id, demand);
    mapper.lotState(t(), id, lot.revision(), "ready");
    bump(p);
    event(project, "package_demand_created", id + ":" + demand);
    return detail(mapper.lot(t(), id));
  }

  @Transactional
  public PackageDetail link(String project, String id, PackageDemandLink a) {
    guard.lock();
    var p = mutable(project);
    var lot = requireLot(project, id, true);
    revision(lot.revision(), a.revision());
    if (!List.of("draft", "ready").contains(lot.status()) || !mapper.runs(t(), id).isEmpty())
      throw new IllegalStateException("已采购或已取消分包不能改变需求");
    permissions.require("buyer:demand:read");
    var d = projects.demand(t(), a.demandId());
    if (d == null) throw new IllegalArgumentException("需求不存在");
    scopes.requireRecordAccess(d.departmentId(), d.requesterId());
    if (!p.departmentId().equals(d.departmentId())
        || !p.period().equals(d.period())
        || !List.of("草稿", "已通过", "审批中", "已驳回").contains(d.status())
        || projects.activeRfq(t(), d.id()) > 0)
      throw new IllegalStateException("需求须为同部门年度、尚未转采购的有效需求");
    String parent = projects.demandProject(t(), d.id());
    if (parent != null && !parent.equals(project)
        || mapper.demandLot(t(), d.id()) != null
        || policy.legacyDemands(p).contains(d.id()))
      throw new IllegalStateException("需求已关联其他项目、分包或原采购执行");
    var expected = new HashMap<String, BigDecimal>();
    for (var l : policy.lines(lot.lines())) expected.put(l.materialId(), l.quantity());
    var current = new HashMap<String, BigDecimal>();
    BigDecimal amount = d.budget();
    var ids = new ArrayList<>(mapper.lotDemands(t(), id));
    ids.add(d.id());
    for (var demand : ids) {
      if (!demand.equals(d.id())) amount = amount.add(projects.demand(t(), demand).budget());
      for (var l : policy.tree(mapper.demandLines(t(), demand)))
        current.merge(
            l.path("materialId").asText(), l.path("quantity").decimalValue(), BigDecimal::add);
    }
    if (amount.compareTo(lot.amount()) > 0
        || current.entrySet().stream()
            .anyMatch(
                e ->
                    e.getValue().compareTo(expected.getOrDefault(e.getKey(), BigDecimal.ZERO)) > 0))
      throw new IllegalStateException("关联需求累计数量或预算超过分包范围");
    if (parent == null) projects.linkDemand(t(), project, d.id(), actor());
    mapper.link(t(), id, d.id());
    mapper.lotState(t(), id, lot.revision(), "ready");
    bump(p);
    event(project, "package_demand_linked", id + ":" + d.id());
    return detail(mapper.lot(t(), id));
  }

  @Transactional
  public PackageDetail execute(String project, String id, PackageExecution a, boolean retry) {
    guard.lock();
    if (!List.of("rfq","tender","auction").contains(a.type()))
      throw new IllegalArgumentException("不支持的分包采购方式");
    if (!"auction".equals(a.type()) && (a.startPrice()!=null || a.minDecrement()!=null
        || a.startsAt()!=null || a.deadlineAt()!=null || a.softCloseTriggerMinutes()!=null || a.softCloseExtendMinutes()!=null))
      throw new IllegalArgumentException("仅竞价采购可设置竞价参数");
    var p = mutable(project);
    var lot = requireLot(project, id, true);
    revision(lot.revision(), a.revision());
    if (!"ready".equals(lot.status())) throw new IllegalStateException("分包不在待采购状态");
    var active = mapper.runs(t(), id).stream().filter(r -> "active".equals(r.status())).findFirst();
    if (retry) {
      var old = active.orElseThrow(() -> new IllegalStateException("分包没有待重采的执行"));
      requireRun(old, true);
      String status =
          "rfq".equals(old.executionType())
              ? mapper.rfqStatus(t(), old.executionId())
              : mapper.tenderStatus(t(), old.executionId());
      if (!List.of("已流标", "已废标").contains(Objects.toString(status, "")))
        throw new IllegalStateException("只有已流标、已废标且无订单的执行可重采");
      String rfq = rfq(old);
      if (rfq != null && mapper.rfqOrders(t(), rfq) > 0)
        throw new IllegalStateException("已有订单，不能用重采跳过履约及财务处理");
      if (mapper.abandon(t(), old.id(), a.reason()) != 1) throw new IllegalStateException("执行已变化");
    } else if (active.isPresent()) throw new IllegalStateException("分包已有有效执行，请勿重复下发");
    policy.validateLotDemands(lot);
    var ids = mapper.lotDemands(t(), id);
    if ("auction".equals(a.type())) {
      var ceiling = ids.stream().map(d -> projects.demand(t(), d).budget())
          .reduce(BigDecimal.ZERO, BigDecimal::add).min(lot.amount());
      var start = a.startPrice() == null ? ceiling : a.startPrice();
      if (start.signum() <= 0 || start.compareTo(ceiling) > 0)
        throw new IllegalArgumentException("竞价起拍价不得超过已批准需求及分包金额");
      if (a.minDecrement() != null && a.minDecrement().compareTo(start) > 0)
        throw new IllegalArgumentException("最小降价步长不得大于起拍价");
      rfqs.createProjectAuctionDraft(p.title() + " · " + lot.title(), ids, start,
          a.minDecrement(), a.startsAt(), a.deadlineAt(),a.softCloseTriggerMinutes(),a.softCloseExtendMinutes());
    } else if ("rfq".equals(a.type())) rfqs.createProjectDraft(p.title() + " · " + lot.title(), ids);
    else {
      String tender =
          tenders.createProjectDraft(
              p.title() + " · " + lot.title(),
              ids.stream()
                  .map(d -> projects.demand(t(), d).budget())
                  .reduce(BigDecimal.ZERO, BigDecimal::add));
      mapper.insertRun(
          t(), project, id, "project-run-" + UUID.randomUUID(), "tender", tender, actor());
      mapper.lotState(t(), id, lot.revision(), "ready");
      bump(p);
    }
    event(
        project, retry ? "package_reprocured" : "package_execution_created", id + ":" + a.reason());
    return detail(mapper.lot(t(), id));
  }

  public String rfq(Run r) {
    if ("rfq".equals(r.executionType())) return r.executionId();
    String order = projects.tenderOrder(t(), r.executionId());
    return order == null ? null : projects.orderRfq(t(), order);
  }

  public void requireRun(Run r, boolean write) {
    if ("rfq".equals(r.executionType())) {
      permissions.require(write ? "buyer:rfq:manage" : "buyer:rfq:read");
      scopes.requireCreatorAccess(mapper.rfqOwner(t(), r.executionId()));
    } else {
      permissions.require(write ? "buyer:tender:manage" : "buyer:tender:read");
      scopes.requireCreatorAccess(projects.tenderOwner(t(), r.executionId()));
    }
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public ChangePage changes(String project, int page, int size) {
    guard.require(project, false);
    if (page < 1 || size < 1 || size > 100) throw new IllegalArgumentException("分页参数无效");
    return new ChangePage(
        mapper.changes(t(), project, size, (long) (page - 1) * size),
        mapper.changeCount(t(), project),
        page,
        size,
        mapper.pending(t(), project) > 0,
        mapper.openChanges(t(), project) > 0);
  }

  public Change change(String project, String id, boolean write) {
    guard.require(project, write);
    var c = mapper.change(t(), id);
    if (c == null || !project.equals(c.projectId())) throw new IllegalArgumentException("变更申请不存在");
    return c;
  }

  @Transactional
  public Change saveChange(String project, String id, ChangeDraft a) {
    guard.lock();
    var p = mutable(project);
    revision(p.revision(), a.projectRevision());
    policy.freezeLegacy(p);
    permissions.require("buyer:material:read");
    scopes.requireRecordAccess(a.proposal().departmentId(), actor());
    var lines = policy.validateChange(p, a.proposal());
    if (id == null && mapper.openChanges(t(), project) > 0)
      throw new IllegalStateException("已有未完成的变更草稿或审批，请先处理");
    String payload = policy.write(Map.of("plan", a.proposal(), "lines", lines));
    if (id == null) {
      id = "project-change-" + UUID.randomUUID();
      mapper.insertChange(
          t(),
          project,
          id,
          p.revision(),
          policy.write(policy.definition(p)),
          payload,
          plans.total(lines),
          a.reason(),
          actor());
    } else {
      var c = change(project, id, true);
      revision(c.revision(), a.revision());
      revision(p.revision(), c.basedRevision());
      if (!"draft".equals(c.status()) && mapper.openChanges(t(), project) > 0)
        throw new IllegalStateException("已有另一条未完成变更");
      if (mapper.editChange(t(), id, a.revision(), payload, plans.total(lines), a.reason()) != 1)
        throw new IllegalStateException("仅草稿、驳回或撤回申请可编辑");
    }
    event(project, "change_saved", id + ":" + a.reason());
    return change(project, id, false);
  }

  public Draft proposal(Change c) {
    return policy.read(policy.tree(c.proposal()).path("plan").toString(), Draft.class);
  }

  @Transactional
  public Change submitChange(String project, String id, Action a) {
    guard.lock();
    var p = mutable(project);
    var c = change(project, id, true);
    revision(c.revision(), a.revision());
    revision(p.revision(), c.basedRevision());
    if (!List.of("draft", "rejected", "withdrawn").contains(c.status()))
      throw new IllegalStateException("变更不在可提交状态");
    if (!"draft".equals(c.status()) && mapper.openChanges(t(), project) > 0)
      throw new IllegalStateException("已有另一条变更申请");
    policy.validateChange(p, proposal(c));
    mapper.changeState(t(), id, c.revision(), "submitted", null, null);
    c = mapper.change(t(), id);
    var snapshot = new LinkedHashMap<String, Object>();
    snapshot.put("projectId", project);
    snapshot.put("title", proposal(c).title());
    snapshot.put("reason", c.reason());
    snapshot.put("before", policy.tree(c.beforeSnapshot()));
    snapshot.put("proposal", policy.tree(c.proposal()));
    var started =
        workflow.start(
            new WorkflowStartCommand(
                "project_change",
                id,
                proposal(c).departmentId(),
                c.amount().max(p.plannedAmount()),
                a.formData() == null ? Map.of() : a.formData(),
                snapshot));
    if (mapper.changeState(t(), id, c.revision(), "submitted", started.workflowInstanceId(), null)
        != 1) throw new IllegalStateException("变更绑定流程失败");
    event(project, "change_submitted", id);
    return change(project, id, false);
  }

  @Transactional
  public Change withdrawChange(String project, String id, Action a) {
    guard.lock();
    var c = change(project, id, true);
    revision(c.revision(), a.revision());
    if ("submitted".equals(c.status()))
      workflow.withdrawProcurementProject(c.workflowInstanceId(), a.reason());
    else if ("draft".equals(c.status())) {
      if (!actor().equals(c.createdBy())) throw new PermissionDeniedException("仅变更草稿创建人可撤回");
      mapper.changeState(t(), id, c.revision(), "withdrawn", null, null);
    } else throw new IllegalStateException("变更已结束");
    event(project, "change_withdrawn", id + ":" + a.reason());
    return change(project, id, false);
  }
}
