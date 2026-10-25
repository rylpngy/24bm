package com.procurement.buyer.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.ProjectContracts.*;
import com.procurement.buyer.infrastructure.ProcurementProjectMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.identity.application.*;
import com.procurement.sourcing.application.ProcurementExecutionApplicationService;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.tender.application.TenderApplicationService;
import com.procurement.workflow.application.*;
import java.math.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class ProcurementProjectService {
  private final ProcurementProjectMapper mapper;
  private final ProcurementProjectGuard guard;
  private final PermissionService permissions;
  private final DataScopeService scopes;
  private final AuditLogApplicationService audit;
  private final UnifiedWorkflowApplicationService workflow;
  private final PurchaseDemandApplicationService demands;
  private final RfqApplicationService rfqs;
  private final TenderApplicationService tenders;
  private final ProcurementExecutionApplicationService execution;
  private final BudgetControlService budget;
  private final ProjectExpansionService expansions;
  private final ProjectCloseoutService closeout;

  public ProcurementProjectService(
      ProcurementProjectMapper mapper,
      ProcurementProjectGuard guard,
      PermissionService permissions,
      DataScopeService scopes,
      AuditLogApplicationService audit,
      UnifiedWorkflowApplicationService workflow,
      PurchaseDemandApplicationService demands,
      RfqApplicationService rfqs,
      TenderApplicationService tenders,
      ProcurementExecutionApplicationService execution,
      BudgetControlService budget, ProjectExpansionService expansions, ProjectCloseoutService closeout) {
    this.mapper = mapper;
    this.guard = guard;
    this.permissions = permissions;
    this.scopes = scopes;
    this.audit = audit;
    this.workflow = workflow;
    this.demands = demands;
    this.rfqs = rfqs;
    this.tenders = tenders;
    this.execution = execution;
    this.budget = budget;
    this.expansions=expansions;
    this.closeout=closeout;
  }

  private String tenant() {
    return TenantAccessGuard.requireTenantId("project");
  }

  private String actor() {
    return TenantAccessGuard.requireUserId("project");
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Page list(int page, int size, String status, String keyword) {
    permissions.require("buyer:project:read");
    if (page < 1 || size < 1 || size > 100 || keyword.length() > 200)
      throw new IllegalArgumentException("分页或搜索条件不合法");
    if (!List.of(
            "", "draft", "submitted", "approved", "rejected", "withdrawn", "terminated", "closed")
        .contains(status)) throw new IllegalArgumentException("项目状态无效");
    var scope = scopes.currentUserDataScope();
    return new Page(
        mapper.list(tenant(), scope, status, keyword.strip(), size, (long) (page - 1) * size),
        mapper.count(tenant(), scope, status, keyword.strip()),
        page,
        size);
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Detail detail(String id) {
    return new Detail(guard.require(id, false), mapper.lines(tenant(), id));
  }

  public Options options() {
    permissions.require("buyer:project:manage");
    var scope = scopes.currentUserDataScope();
    return new Options(mapper.departments(tenant(), scope), mapper.owners(tenant(), scope));
  }

  private List<Line> validate(Draft d) {
    permissions.require("buyer:material:read");
    scopes.requireRecordAccess(d.departmentId(), actor());
    if (!mapper.validOwner(tenant(), d.departmentId(), d.ownerId()))
      throw new IllegalArgumentException("请选择本企业有效部门和该部门在职负责人");
    var lines = new ArrayList<Line>();
    int index = 0;
    var seen = new HashSet<String>();
    for (var l : d.lines()) {
      if (!seen.add(l.materialId())) throw new IllegalArgumentException("重复物料请合并数量");
      var m = mapper.material(tenant(), l.materialId());
      if (m == null) throw new IllegalArgumentException("物料不属于当前企业");
      if (l.quantity().signum() <= 0
          || l.quantity().scale() > 4
          || l.unitPrice().signum() < 0
          || l.unitPrice().scale() > 4
          || l.quantity().precision() - l.quantity().scale() > 12
          || l.unitPrice().precision() - l.unitPrice().scale() > 12)
        throw new IllegalArgumentException("数量及单价最多4位小数、12位整数");
      lines.add(
          new Line(
              String.format("%04d", ++index),
              l.materialId(),
              String.valueOf(m.get("name")),
              Objects.toString(m.get("specification"), ""),
              Objects.toString(m.get("unit"), ""),
              l.quantity(),
              l.unitPrice(),
              l.purpose() == null ? "" : l.purpose().strip()));
    }
    BigDecimal total = total(lines);
    if (total.signum() <= 0 || total.precision() - total.scale() > 14)
      throw new IllegalArgumentException("项目明细合计须大于0且不超过14位整数");
    return lines;
  }

  private BigDecimal total(List<Line> lines) {
    return lines.stream()
        .map(l -> l.quantity().multiply(l.unitPrice()).setScale(2, RoundingMode.HALF_UP))
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  private void saveLines(String id, List<Line> lines) {
    mapper.replaceLines(tenant(), id);
    for (var l : lines)
      mapper.insertLine(
          tenant(),
          id,
          new Line(
              id + "-" + l.id(),
              l.materialId(),
              l.name(),
              l.specification(),
              l.unit(),
              l.quantity(),
              l.unitPrice(),
              l.purpose()));
  }

  private void revision(Project p, int revision) {
    if (p.revision() != revision) throw new IllegalStateException("项目已被修改，请刷新后重试");
  }

  private void event(String id, String action, String reason) {
    audit.recordTenantAction(tenant(), "project." + action, "procurement_project", id, reason);
  }

  @Transactional
  public Detail create(Draft d) {
    permissions.require("buyer:project:manage");
    guard.lock();
    var lines = validate(d);
    String id = "project-" + UUID.randomUUID();
    String no =
        "PRJ-"
            + d.period()
            + "-"
            + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    mapper.insert(tenant(), id, no, d, total(lines), actor());
    saveLines(id, lines);
    event(id, "created", d.title());
    return detail(id);
  }

  @Transactional
  public Detail edit(String id, Draft d) {
    guard.lock();
    var p = guard.require(id, true);
    revision(p, d.revision());
    if (!List.of("draft", "rejected", "withdrawn").contains(p.status()))
      throw new IllegalStateException("只能编辑草稿、驳回或已撤回项目");
    var lines = validate(d);
    if (mapper.edit(tenant(), id, d, total(lines)) != 1) throw new IllegalStateException("项目已变化");
    saveLines(id, lines);
    event(id, "edited", d.title());
    return detail(id);
  }

  @Transactional
  public Detail submit(String id, Action a) {
    guard.lock();
    var p = guard.require(id, true);
    revision(p, a.revision());
    if (!List.of("draft", "rejected", "withdrawn").contains(p.status()))
      throw new IllegalStateException("项目不在可提交状态");
    if (!mapper.validOwner(tenant(), p.departmentId(), p.ownerId()))
      throw new IllegalStateException("项目部门或负责人已失效");
    mapper.state(tenant(), id, p.revision(), "submitted", null, a.reason());
    p = mapper.find(tenant(), id);
    var snapshot = new LinkedHashMap<>(guard.archiveDefinition(id));
    snapshot.put("submissionReason", a.reason());
    var started =
        workflow.start(
            new WorkflowStartCommand(
                "project_initiation",
                id,
                p.departmentId(),
                p.plannedAmount(),
                a.formData() == null ? Map.of() : a.formData(),
                snapshot));
    if (mapper.state(
            tenant(), id, p.revision(), "submitted", started.workflowInstanceId(), a.reason())
        != 1) throw new IllegalStateException("流程绑定失败");
    event(id, "submitted", a.reason());
    return detail(id);
  }

  @Transactional
  public Detail withdraw(String id, Action a) {
    guard.lock();
    var p = guard.require(id, true);
    revision(p, a.revision());
    workflow.withdrawProcurementProject(p.workflowInstanceId(), a.reason());
    return detail(id);
  }

  public List<Demand> demands(String id) {
    var p = guard.require(id, false);
    permissions.require("buyer:demand:read");
    var result = mapper.demands(tenant(), id);
    for (var d : result) scopes.requireRecordAccess(d.departmentId(), d.requesterId());
    return result;
  }

  @Transactional
  public Detail link(String id, LinkRequest r) {
    guard.lock();
    var p = guard.require(id, true);
    revision(p, r.revision());
    guard.approved(p);
    if (p.executionId() != null) throw new IllegalStateException("已下发采购，不能改变需求集合");
    expansions.requireLegacyMode(p);
    permissions.require("buyer:demand:read");
    var d = mapper.demand(tenant(), r.demandId());
    if (d == null) throw new IllegalArgumentException("需求不存在");
    scopes.requireRecordAccess(d.departmentId(), d.requesterId());
    if (!p.departmentId().equals(d.departmentId())
        || !p.period().equals(d.period())
        || !List.of("草稿", "审批中", "已通过", "已驳回").contains(d.status()))
      throw new IllegalArgumentException("需求须属于项目部门及年度且未转采购");
    if (mapper.demandProject(tenant(), d.id()) != null || mapper.activeRfq(tenant(), d.id()) > 0)
      throw new IllegalStateException("需求已有项目或采购执行关联");
    mapper.linkDemand(tenant(), id, d.id(), actor());
    mapper.state(tenant(), id, p.revision(), p.status(), null, p.closeoutReason());
    event(id, "demand_linked", d.id());
    return detail(id);
  }

  @Transactional
  public Detail createDemand(String id, Action a) {
    guard.lock();
    var p = guard.require(id, true);
    revision(p, a.revision());
    guard.approved(p);
    if (!mapper.demands(tenant(), id).isEmpty() || p.executionId() != null)
      throw new IllegalStateException("已有需求，请维护关联需求，不重复生成");
    expansions.requireLegacyMode(p);
    if (!p.period().equals(String.valueOf(LocalDate.now(ZoneId.of("Asia/Shanghai")).getYear())))
      throw new IllegalStateException("仅当前年度项目可生成需求，不能改变现有预算年度口径");
    String demand =
        demands.createProjectDemand(
            p.title(),
            p.departmentId(),
            p.plannedAmount(),
            mapper.lines(tenant(), id).stream()
                .map(
                    l ->
                        new PurchaseDemandApplicationService.ProjectLine(
                            l.materialId(), l.quantity()))
                .toList(),
            p.purpose());
    mapper.linkDemand(tenant(), id, demand, actor());
    mapper.state(tenant(), id, p.revision(), p.status(), null, p.closeoutReason());
    event(id, "demand_created", demand);
    return detail(id);
  }

  @Transactional
  public Detail createExecution(String id, ExecutionRequest r) {
    guard.lock();
    var p = guard.require(id, true);
    revision(p, r.revision());
    guard.approved(p);
    if (p.executionId() != null) throw new IllegalStateException("项目已有采购执行");
    expansions.requireLegacyMode(p);
    var linked = demands(id);
    if (linked.isEmpty()
        || linked.stream()
            .anyMatch(d -> !"已通过".equals(d.status()) || mapper.activeRfq(tenant(), d.id()) > 0))
      throw new IllegalStateException("须先完成所有关联需求审批，且不能已被采购占用");
    if ("rfq".equals(r.type()))
      rfqs.createProjectDraft(p.title(), linked.stream().map(Demand::id).toList());
    else {
      String tender =
          tenders.createProjectDraft(
              p.title(),
              linked.stream().map(Demand::budget).reduce(BigDecimal.ZERO, BigDecimal::add));
      if (mapper.bindExecution(tenant(), id, "tender", tender) != 1)
        throw new IllegalStateException("项目已有采购执行");
    }
    event(id, "execution_created", r.type());
    return detail(id);
  }

  public String executionRfq(Project p) {
    if ("rfq".equals(p.executionType())) return p.executionId();
    if ("tender".equals(p.executionType())) {
      String order = mapper.tenderOrder(tenant(), p.executionId());
      return order == null ? null : mapper.orderRfq(tenant(), order);
    }
    return null;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Execution execution(String id) { return expansions.summary(id); }

  public com.procurement.buyer.domain.BudgetPosition budget(String id) {
    var p = guard.require(id, false);
    permissions.require("buyer:budget:read");
    if (scopes.currentUserDataScope().requesterId() != null)
      throw new com.procurement.common.tenant.PermissionDeniedException("部门年度汇总需部门或企业数据范围");
    scopes.requireRecordAccess(p.departmentId(), p.createdBy());
    return budget.position(tenant(), p.departmentId(), p.period());
  }

  @Transactional
  public Detail close(String id, Action a) { expansions.closeProject(id,a); return detail(id); }

  @Transactional
  public Detail terminate(String id, Action a) {
    closeout.terminate(id,a);
    return detail(id);
  }
}
