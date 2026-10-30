package com.procurement.buyer.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.ProjectContracts.Project;
import com.procurement.buyer.api.ProjectLifecycleContracts.*;
import com.procurement.buyer.api.ProjectLifecycleContracts.Record;
import com.procurement.buyer.infrastructure.*;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.*;
import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class ProjectReopenService {
  private final ProcurementProjectGuard guard;
  private final ProcurementProjectMapper projects;
  private final ProjectExpansionMapper packages;
  private final ProjectLifecycleMapper lifecycle;
  private final ProjectReopenMapper mapper;
  private final ProjectAllocationPolicy json;
  private final FundingMapper funds;
  private final PermissionService permissions;
  private final DataScopeService scopes;
  private final BudgetControlService budget;
  private final AuditLogApplicationService audit;
  @Autowired @Lazy private UnifiedWorkflowApplicationService workflow;
  @Autowired @Lazy private ProjectCloseoutService closeout;

  public ProjectReopenService(
      ProcurementProjectGuard guard,
      ProcurementProjectMapper projects,
      ProjectExpansionMapper packages,
      ProjectLifecycleMapper lifecycle,
      ProjectReopenMapper mapper,
      ProjectAllocationPolicy json,
      FundingMapper funds,
      PermissionService permissions,
      DataScopeService scopes,
      BudgetControlService budget,
      AuditLogApplicationService audit) {
    this.guard = guard;
    this.projects = projects;
    this.packages = packages;
    this.lifecycle = lifecycle;
    this.mapper = mapper;
    this.json = json;
    this.funds = funds;
    this.permissions = permissions;
    this.scopes = scopes;
    this.budget = budget;
    this.audit = audit;
  }

  private boolean closed(Project p) {
    return List.of("closed", "terminated").contains(p.status());
  }

  public String orderGrant(String tenant, String order) {
    return mapper.orderGrant(tenant, order);
  }

  private String actor() {
    return TenantAccessGuard.requireUserId("project reopen");
  }

  private String period(Project p) {
    String year = lifecycle.period(p.tenantId(), p.id());
    return year == null ? p.period() : year;
  }

  private ReopenPreview inspect(Project p, String packageId, boolean own, boolean write) {
    var errors = new ArrayList<String>();
    var lots = packages.packages(p.tenantId(), p.id());
    if (!closed(p) && !("approved".equals(p.status()) && packageId != null))
      errors.add("仅已结项/终止项目，或已批准项目的已结项分包可申请重开");
    if (!mapper.approved(p.tenantId(), p.id())) errors.add("缺少原立项批准记录，请重新立项，不得通过重开绕过审批");
    if (packageId != null
        && lots.stream().noneMatch(l -> l.id().equals(packageId) && "closed".equals(l.status())))
      errors.add("所选分包必须属于本项目且已结项；终止分包请新建分包承接");
    if (packages.openChanges(p.tenantId(), p.id()) > 0
        || lifecycle.pending(p.tenantId(), p.id()) > (own ? 1 : 0))
      errors.add("项目已有未结束的变更或承接、清算、重开申请");
    if (funds.pending(p.tenantId(), null, p.id()) > 0
        || funds.pendingCorrection(p.tenantId(), p.id()) > 0
        || mapper.pendingSettlements(p.tenantId(), p.id()) > 0) errors.add("请先处理在审资金、冻结付款更正或订单清算");
    if (lifecycle.mixedSources(p.tenantId(), p.id()) > 0
        || lifecycle.invalidPayments(p.tenantId(), p.id()) > 0) errors.add("采购归属或原付款不一致，不能推算恢复责任");
    var lines = new ArrayList<ReopenFund>();
    var balances = funds.balances(p.tenantId(), p.id());
    if (closed(p) && !balances.isEmpty()) {
      if (!permissions.currentUserHas("buyer:budget:read") && write)
        permissions.require("buyer:budget:read");
      if (write) permissions.require("buyer:budget:manage");
      if (!own
          && (!permissions.currentUserHas("buyer:budget:read")
              || !permissions.currentUserHas("buyer:budget:manage")))
        errors.add("专项项目重开需要预算查看与管理权限");
      var prior = funds.priorPaid(p.tenantId(), p.id());
      if (balances.stream()
                  .map(b -> b.allocatedAmount())
                  .reduce(prior, BigDecimal::add)
                  .compareTo(p.plannedAmount())
              != 0
          || funds
                  .totalPaid(p.tenantId(), p.id())
                  .compareTo(
                      lifecycle.paidEntries(p.tenantId(), p.id()).stream()
                          .map(PaymentBasis::amount)
                          .reduce(BigDecimal.ZERO, BigDecimal::add))
              != 0) errors.add("专项责任、原实际付款与批准金额不一致");
      for (var b : balances) {
        var f = funds.fund(p.tenantId(), b.fundId());
        if (f == null
            || !"approved".equals(f.status())
            || !f.period().equals(period(p))
            || !f.departmentId().equals(p.departmentId())
            || b.remainingAmount().signum() < 0
            || b.paidAmount().signum() < 0) {
          errors.add("专项来源年度、部门或责任金额无法核验");
          continue;
        }
        if (write) scopes.requireRecordAccess(f.departmentId(), f.createdBy());
        if (funds.pending(p.tenantId(), f.id(), null) > 0) errors.add(f.name() + "：来源额度审批中");
        if (f.availableAmount().compareTo(b.remainingAmount()) < 0)
          errors.add(f.name() + "：当前可用额度不足以恢复已释放责任");
        lines.add(new ReopenFund(f.id(), f.name(), f.revision(), b.remainingAmount()));
      }
    }
    return new ReopenPreview(
        p.status(),
        packageId,
        period(p),
        lines.stream().map(ReopenFund::restoreAmount).reduce(BigDecimal.ZERO, BigDecimal::add),
        own || permissions.currentUserHas("buyer:budget:read") ? lines : List.of(),
        lots.stream()
            .filter(l -> "closed".equals(l.status()))
            .map(l -> new ReopenPackage(l.id(), l.title(), l.revision()))
            .toList(),
        errors.stream().distinct().toList());
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public ReopenPreview preview(String id, String packageId) {
    return inspect(guard.require(id, false), packageId, false, false);
  }

  private Map<String, Object> basis(Project p, String packageId, List<ReopenFund> funding) {
    var b = new LinkedHashMap<String, Object>();
    b.put("project", p);
    b.put("definition", json.definition(p));
    b.put("packageId", packageId);
    b.put("packages", packages.packages(p.tenantId(), p.id()));
    b.put("demands", projects.demands(p.tenantId(), p.id()));
    b.put("sources", lifecycle.sources(p.tenantId(), p.id()));
    b.put("payments", lifecycle.paidEntries(p.tenantId(), p.id()));
    b.put("archives", mapper.archives(p.tenantId(), p.id()));
    b.put("funding", funding);
    b.put("fundingPlan", funds.plan(p.tenantId(), p.id()));
    b.put("period", period(p));
    b.put("financialBasis", json.tree(mapper.financialBasis(p.tenantId(), p.id())));
    return b;
  }

  private void allowed(ReopenPreview v) {
    if (!v.blockers().isEmpty()) throw new IllegalStateException(String.join("；", v.blockers()));
  }

  private com.fasterxml.jackson.databind.JsonNode normalized(
      com.fasterxml.jackson.databind.JsonNode n) {
    // PostgreSQL jsonb normalizes numeric notation, including 100.00 and 1E+2.
    if (n.isNumber())
      return com.fasterxml.jackson.databind.node.DecimalNode.valueOf(
          n.decimalValue().stripTrailingZeros());
    var copy = n.deepCopy();
    if (copy.isObject()) {
      var o = (com.fasterxml.jackson.databind.node.ObjectNode) copy;
      n.fields().forEachRemaining(e -> o.set(e.getKey(), normalized(e.getValue())));
    }
    if (copy.isArray()) {
      var a = (com.fasterxml.jackson.databind.node.ArrayNode) copy;
      for (int index = 0; index < a.size(); index++) a.set(index, normalized(a.get(index)));
    }
    return copy;
  }

  @Transactional
  public Record submit(String id, Request r) {
    guard.lock();
    var p = guard.require(id, true);
    funds.lock(p.tenantId());
    lifecycle.lockOrders(p.tenantId(), id);
    if (p.revision() != r.revision()) throw new IllegalStateException("项目已变化，请刷新");
    if (r.targetPeriod() != null || r.fundingSources() != null && !r.fundingSources().isEmpty())
      throw new IllegalArgumentException("重开不修改年度或资金来源，请走独立承接/资金调整");
    var v = inspect(p, r.packageId(), false, true);
    allowed(v);
    if (r.packageId() == null && r.packageRevision() != null
        || r.packageId() != null
            && (r.packageRevision() == null
                || packages.lot(p.tenantId(), r.packageId()).revision() != r.packageRevision()))
      throw new IllegalStateException("分包版本已变化，请刷新");
    var snapshot = new LinkedHashMap<String, Object>();
    snapshot.put("projectId", id);
    snapshot.put("title", p.title());
    snapshot.put("reason", r.reason());
    snapshot.put("reopen", basis(p, r.packageId(), v.funds()));
    String key = "project-reopen-" + UUID.randomUUID();
    var priorClosure = closed(p) ? mapper.closureForRevision(p.tenantId(), id, p.revision()) : null;
    byte[] archive =
        closed(p) ? priorClosure == null ? closeout.download(id) : priorClosure.bytes() : null;
    if (priorClosure != null
        && !priorClosure
            .sha256()
            .equals(
                com.procurement.sourcing.application.ProcurementExecutionArchiveWriter.sha256(
                    archive))) throw new IllegalStateException("原关闭档案完整性核验失败");
    snapshot.put("reopenRequestId", key);
    if (archive != null)
      snapshot.put(
          "closureArchive",
          Map.of(
              "sha256",
              com.procurement.sourcing.application.ProcurementExecutionArchiveWriter.sha256(
                  archive),
              "size",
              archive.length));
    lifecycle.insert(
        key,
        p.tenantId(),
        id,
        "reopen",
        period(p),
        period(p),
        p.revision(),
        r.reason().strip(),
        json.write(snapshot),
        v.restoreAmount(),
        actor());
    if (archive != null)
      mapper.insertArchive(
          p.tenantId(),
          key,
          com.procurement.sourcing.application.ProcurementExecutionArchiveWriter.sha256(archive),
          archive);
    var flow =
        workflow.start(
            new WorkflowStartCommand(
                "project_reopen",
                key,
                p.departmentId(),
                p.plannedAmount(),
                r.formData() == null ? Map.of() : r.formData(),
                snapshot));
    if (lifecycle.bind(p.tenantId(), key, flow.workflowInstanceId()) != 1)
      throw new IllegalStateException("重开流程绑定失败");
    audit.recordTenantAction(
        p.tenantId(),
        "project.reopen_submitted",
        "procurement_project",
        id,
        key + ":" + r.reason());
    return lifecycle.find(p.tenantId(), key);
  }

  public Record validate(WorkflowBusinessInstance i, boolean approved) {
    budget.lock(i.tenantId());
    projects.lock(i.tenantId());
    funds.lock(i.tenantId());
    var r = lifecycle.find(i.tenantId(), i.businessId());
    if (r == null
        || !"reopen".equals(r.kind())
        || !"submitted".equals(r.status())
        || !i.id().equals(r.workflowInstanceId())) throw new IllegalStateException("重开不在对应审批中");
    lifecycle.lockOrders(i.tenantId(), r.projectId());
    if (approved) {
      var p = projects.find(i.tenantId(), r.projectId());
      var old = json.tree(r.snapshot()).path("reopen");
      String packageId = old.path("packageId").asText(null);
      var now = inspectForApproval(p, packageId);
      allowed(now);
      if (p.revision() != r.projectRevision()
          || !normalized(old)
              .equals(normalized(json.tree(json.write(basis(p, packageId, now.funds()))))))
        throw new IllegalStateException("关闭状态、分包、资金或履约依据已变化，请驳回后重新核对");
    }
    return r;
  }

  private ReopenPreview inspectForApproval(Project p, String lot) {
    // Workflow assignees need not hold the initiator's budget permissions.
    return inspect(p, lot, true, false);
  }

  @Transactional
  public void complete(WorkflowBusinessInstance i, WorkflowCompletion c) {
    var r = validate(i, c.approved());
    if (lifecycle.finish(
            i.tenantId(), r.id(), r.revision(), c.approved() ? "approved" : "rejected", c.actorId())
        != 1) throw new IllegalStateException("重开申请已变化");
    if (c.approved()) {
      var p = projects.find(i.tenantId(), r.projectId());
      var b = json.tree(r.snapshot()).path("reopen");
      String lot = b.path("packageId").asText(null);
      if (lot != null) {
        var l = packages.lot(i.tenantId(), lot);
        if (packages.lotState(i.tenantId(), lot, l.revision(), "ready") != 1)
          throw new IllegalStateException("分包已变化");
      }
      if (projects.state(i.tenantId(), p.id(), p.revision(), "approved", null, r.reason()) != 1)
        throw new IllegalStateException("项目已变化");
      for (var l : funds.balances(i.tenantId(), p.id()))
        if (funds.fund(i.tenantId(), l.fundId()).availableAmount().signum() < 0)
          throw new IllegalStateException("专项责任恢复后超出来源额度");
      budget.checkProjectCarryover(i.tenantId(), p.departmentId(), period(p), r.id());
    }
    audit.recordTenantAction(
        i.tenantId(),
        "project.reopen_" + (c.approved() ? "approved" : "rejected"),
        "procurement_project",
        r.projectId(),
        r.id() + ":" + c.comment());
  }

  @Transactional
  public void cancel(WorkflowBusinessInstance i, String actor) {
    var r = validate(i, false);
    if (lifecycle.finish(i.tenantId(), r.id(), r.revision(), "withdrawn", actor) != 1)
      throw new IllegalStateException("重开申请已变化");
  }

  @Transactional(readOnly = true)
  public byte[] archive(String project, String id) {
    var p = guard.require(project, false);
    closeout.authorizeHistoricalArchive(project);
    var r = lifecycle.find(p.tenantId(), id);
    if (r == null || !project.equals(r.projectId()) || !"reopen".equals(r.kind()))
      throw new IllegalArgumentException("重开记录不存在");
    var file = mapper.findArchive(p.tenantId(), id);
    if (file == null) throw new IllegalArgumentException("该申请无整项目关闭档案，请下载原分包档案");
    if (!file.sha256()
        .equals(
            com.procurement.sourcing.application.ProcurementExecutionArchiveWriter.sha256(
                file.bytes()))) throw new IllegalStateException("原关闭档案完整性核验失败");
    return file.bytes();
  }
}
