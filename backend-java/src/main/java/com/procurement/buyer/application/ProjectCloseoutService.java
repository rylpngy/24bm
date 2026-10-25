package com.procurement.buyer.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.ProjectCloseoutContracts.*;
import com.procurement.buyer.api.ProjectContracts.*;
import com.procurement.buyer.api.ProjectExpansionContracts.*;
import com.procurement.buyer.infrastructure.*;
import com.procurement.common.tenant.*;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.identity.application.*;
import com.procurement.sourcing.application.ProcurementExecutionApplicationService;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.zip.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class ProjectCloseoutService {
  private final ProcurementProjectGuard guard;
  private final ProcurementProjectMapper projects;
  private final ProjectExpansionMapper lots;
  private final ProjectCloseoutMapper mapper;
  private final ProjectExpansionService expansions;
  private final ProjectAllocationPolicy policy;
  private final PurchaseDemandApplicationService demands;
  private final PermissionService permissions;
  private final DataScopeService scopes;
  private final UnifiedWorkflowApplicationService workflow;
  private final BudgetControlService budget;
  private final ProcurementExecutionApplicationService executions;
  private final AuditLogApplicationService audit;
  private final com.procurement.attachment.application.AttachmentApplicationService attachments;
  @org.springframework.beans.factory.annotation.Autowired
  private ProjectLifecycleMapper lifecycle;

  public ProjectCloseoutService(
      ProcurementProjectGuard guard,
      ProcurementProjectMapper projects,
      ProjectExpansionMapper lots,
      ProjectCloseoutMapper mapper,
      ProjectExpansionService expansions,
      ProjectAllocationPolicy policy,
      PurchaseDemandApplicationService demands,
      PermissionService permissions,
      DataScopeService scopes,
      UnifiedWorkflowApplicationService workflow,
      BudgetControlService budget,
      ProcurementExecutionApplicationService executions,
      AuditLogApplicationService audit,
      com.procurement.attachment.application.AttachmentApplicationService attachments) {
    this.guard = guard;
    this.projects = projects;
    this.lots = lots;
    this.mapper = mapper;
    this.expansions = expansions;
    this.policy = policy;
    this.demands = demands;
    this.permissions = permissions;
    this.scopes = scopes;
    this.workflow = workflow;
    this.budget = budget;
    this.executions = executions;
    this.audit = audit;
    this.attachments = attachments;
  }

  private String t() {
    return TenantAccessGuard.requireTenantId("project closeout");
  }

  private String actor() {
    return TenantAccessGuard.requireUserId("project closeout");
  }

  private void version(int actual, int expected) {
    if (actual != expected) throw new IllegalStateException("记录已变化，请刷新后重试");
  }

  private Project writable(String id) {
    var p = guard.require(id, true);
    guard.approved(p);
    policy.noPending(p);
    return p;
  }

  private PackageRow lot(String project, String id) {
    var l = lots.lot(t(), id);
    if (l == null || !project.equals(l.projectId())) throw new IllegalArgumentException("分包不存在");
    return l;
  }

  private void bump(Project p) {
    if (projects.state(t(), p.id(), p.revision(), p.status(), null, p.closeoutReason()) != 1)
      throw new IllegalStateException("项目已变化");
  }

  private void event(
      Project p, String lot, String kind, String reason, Object before, BigDecimal released) {
    mapper.event(
        "project-adjustment-" + UUID.randomUUID(),
        t(),
        p.id(),
        lot,
        kind,
        reason,
        policy.write(before),
        released,
        actor());
    audit.recordTenantAction(
        t(), "project." + kind, "procurement_project", p.id(), reason + ";占用减少:" + released);
  }

  private void cancellable(PackageRow lot, boolean rework) {
    if (!List.of("draft", "ready").contains(lot.status()))
      throw new IllegalStateException("仅未结项、未终止分包可处理");
    var runs = lots.runs(t(), lot.id());
    if (rework && !runs.isEmpty()) throw new IllegalStateException("已下发采购不能重新编制需求，请使用失败重采或原业务变更");
    for (var r : runs) {
      expansions.requireRun(r, true);
      String rfq = expansions.rfq(r);
      if (rfq != null && lots.rfqOrders(t(), rfq) > 0)
        throw new IllegalStateException("已有订单，须先完成合同、履约和财务处理，不能直接终止");
      if ("active".equals(r.status())) {
        String s =
            "rfq".equals(r.executionType())
                ? lots.rfqStatus(t(), r.executionId())
                : lots.tenderStatus(t(), r.executionId());
        if (!List.of("已流标", "已废标", "已取消").contains(Objects.toString(s, "")))
          throw new IllegalStateException("有效采购仍在进行，请先在原采购业务办理流标或废标");
      }
    }
  }

  private Map<String, Object> demandItems(String project) {
    var snapshot = new LinkedHashMap<String, Object>();
    for (var d : projects.demands(t(), project))
      snapshot.put(d.id(), policy.tree(lots.demandLines(t(), d.id())));
    return snapshot;
  }

  @Transactional
  public void adjust(String project, String id, PackageAction a, boolean rework) {
    guard.lock();
    var p = writable(project);
    var l = lot(project, id);
    version(l.revision(), a.revision());
    cancellable(l, rework);
    if (rework && lots.lotDemands(t(), id).isEmpty())
      throw new IllegalStateException("尚未关联需求，请直接编辑草稿分包");
    var detail =
        expansions.packages(project).stream()
            .filter(d -> d.info().id().equals(id))
            .findFirst()
            .orElseThrow();
    var before = budget.position(t(), p.departmentId(), guard.effectivePeriod(p)).occupied();
    for (String d : lots.lotDemands(t(), id))
      demands.resetProjectDemand(project, d, !rework, a.reason());
    if (!rework)
      for (var r : lots.runs(t(), id))
        if ("active".equals(r.status()) && lots.abandon(t(), r.id(), a.reason()) != 1)
          throw new IllegalStateException("执行已变化");
    if (lots.lotState(
            t(),
            id,
            l.revision(),
            rework ? (lots.lotDemands(t(), id).isEmpty() ? "draft" : "ready") : "cancelled")
        != 1) throw new IllegalStateException("分包已变化");
    bump(p);
    var released = before.subtract(budget.position(t(), p.departmentId(), guard.effectivePeriod(p)).occupied());
    event(
        p,
        id,
        rework ? "rework" : "cancel",
        a.reason(),
        Map.of("package", detail, "demandItems", demandItems(project)),
        released);
  }

  @Transactional
  public void terminate(String project, Action a) {
    guard.lock();
    var p = guard.require(project, true);
    policy.noPending(p);
    version(p.revision(), a.revision());
    if (!List.of("draft", "approved", "rejected", "withdrawn").contains(p.status())
        || p.executionId() != null
        || lots.openChanges(t(), project) > 0)
      throw new IllegalStateException("请先处理立项/变更流程；旧单执行及已结项项目不能直接终止");
    var packages = lots.packages(t(), project);
    for (var l : packages) if (!"cancelled".equals(l.status())) cancellable(l, false);
    var before = new LinkedHashMap<String, Object>();
    before.put("project", policy.definition(p));
    before.put("packages", expansions.packages(project));
    before.put("demands", projects.demands(t(), project));
    before.put("demandItems", demandItems(project));
    var occupied = budget.position(t(), p.departmentId(), guard.effectivePeriod(p)).occupied();
    for (var d : projects.demands(t(), project))
      if (!"已取消".equals(d.status())) demands.resetProjectDemand(project, d.id(), true, a.reason());
    for (var l : packages)
      if (!"cancelled".equals(l.status())) {
        for (var r : lots.runs(t(), l.id()))
          if ("active".equals(r.status())) lots.abandon(t(), r.id(), a.reason());
        lots.lotState(t(), l.id(), l.revision(), "cancelled");
      }
    if (projects.state(t(), project, p.revision(), "terminated", null, a.reason()) != 1)
      throw new IllegalStateException("项目已变化");
    event(
        p,
        null,
        "terminate",
        a.reason(),
        before,
        occupied.subtract(budget.position(t(), p.departmentId(), guard.effectivePeriod(p)).occupied()));
  }

  private void authorizeHistory(String id) {
    guard.require(id, false);
    permissions.require("buyer:demand:read");
    for (var d : projects.demands(t(), id))
      scopes.requireRecordAccess(d.departmentId(), d.requesterId());
    for (var l : lots.packages(t(), id))
      for (var r : lots.runs(t(), l.id())) expansions.requireRun(r, false);
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Monitor monitor(String project) {
    var p = guard.require(project, false);
    authorizeHistory(project);
    var rows = new ArrayList<Progress>();
    int overdue = 0;
    var today = LocalDate.now(ZoneId.of("Asia/Shanghai"));
    for (var detail : expansions.packages(project)) {
      var l = detail.info();
      boolean cancelled = "cancelled".equals(l.status());
      var v = expansions.packageExecution(project, l.id());
      var orders = v.documents().stream().filter(d -> "orders".equals(d.module())).toList();
      boolean ordered = !orders.isEmpty();
      boolean paid =
          v.paidAmount() != null
              && v.orderAmount().signum() > 0
              && v.orderAmount().compareTo(v.paidAmount()) == 0
              && v.orderAmount().compareTo(v.invoicedAmount()) == 0;
      var done =
          List.of(
              !detail.demands().isEmpty()
                  && detail.demands().stream()
                      .allMatch(d -> List.of("已通过", "已转询价").contains(d.status())),
              detail.runs().stream().anyMatch(r -> "active".equals(r.status())),
              ordered,
              ordered && orders.stream().allMatch(o -> List.of("已收货", "已完成").contains(o.status())),
              paid,
              "closed".equals(l.status()));
      var keys = List.of("demand", "sourcing", "order", "receipt", "payment", "close");
      var titles = List.of("需求审批通过", "下发有效采购", "生成采购订单", "订单收货登记完成", "净付款登记完成", "分包结项归档");
      var ms = new ArrayList<Milestone>();
      for (int i = 0; i < keys.size(); i++) {
        var due = mapper.due(t(), l.id(), keys.get(i));
        boolean late = !cancelled && !done.get(i) && due != null && due.isBefore(today);
        if (late) overdue++;
        ms.add(
            new Milestone(
                keys.get(i),
                titles.get(i),
                due,
                !cancelled && done.get(i),
                late,
                cancelled ? "分包已终止" : done.get(i) ? "按实际业务记录确认" : "待业务办理"));
      }
      boolean editable = List.of("draft", "ready").contains(l.status());
      boolean canStop =
          editable
              && detail.runs().stream()
                  .allMatch(
                      r -> {
                        String anchor = expansions.rfq(r);
                        if (anchor != null && lots.rfqOrders(t(), anchor) > 0) return false;
                        String status = detail.sourceStatuses().get(r.executionId());
                        return !"active".equals(r.status())
                            || List.of("已流标", "已废标", "已取消").contains(Objects.toString(status, ""));
                      });
      rows.add(
          new Progress(
              l.id(),
              l.title(),
              l.status(),
              l.revision(),
              ms,
              cancelled ? List.of() : v.warnings(),
              editable && !detail.demands().isEmpty() && detail.runs().isEmpty(),
              canStop));
    }
    return new Monitor(
        rows,
        overdue,
        p.plannedAmount().subtract(policy.protectedAmount(p, null)),
        lots.pending(t(), project) > 0);
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public AdjustmentPage history(String project, int page, int size) {
    authorizeHistory(project);
    if (page < 1 || size < 1 || size > 100) throw new IllegalArgumentException("分页参数无效");
    return new AdjustmentPage(
        mapper.pageHistory(t(), project, size, (long) (page - 1) * size),
        mapper.countHistory(t(), project),
        page,
        size);
  }

  @Transactional
  public void plan(String project, String id, Plan a) {
    guard.lock();
    var p = writable(project);
    var l = lot(project, id);
    version(l.revision(), a.revision());
    if (!List.of("draft", "ready").contains(l.status()))
      throw new IllegalStateException("已终止或结项分包不能修改计划");
    var sequence = List.of("demand", "sourcing", "order", "receipt", "payment", "close");
    int index = sequence.indexOf(a.milestone());
    if (index < 0) throw new IllegalArgumentException("计划节点无效");
    for (int n = 0; n < sequence.size(); n++) {
      var due = mapper.due(t(), id, sequence.get(n));
      if (due != null
          && ((n < index && due.isAfter(a.dueDate())) || (n > index && due.isBefore(a.dueDate()))))
        throw new IllegalArgumentException("计划日期须符合需求、采购、订单、收货、付款、结项的先后顺序");
    }
    var old = mapper.due(t(), id, a.milestone());
    mapper.plan(t(), project, id, a.milestone(), a.dueDate(), actor());
    lots.lotState(t(), id, l.revision(), l.status());
    bump(p);
    var snapshot = new LinkedHashMap<String, Object>();
    snapshot.put("milestone", a.milestone());
    snapshot.put("before", old);
    snapshot.put("after", a.dueDate());
    event(p, id, "milestone", a.reason(), snapshot, BigDecimal.ZERO);
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public byte[] download(String project) {
    var p = guard.require(project, false);
    if (!List.of("closed", "terminated").contains(p.status()))
      throw new IllegalStateException("仅已结项或已终止项目可下载整项目档案");
    authorizeHistory(project);
    permissions.require("buyer:workflow:read");
    var files = new LinkedHashMap<String, byte[]>();
    files.put(
        "项目.json",
        policy
            .write(
                Map.of(
                    "status",
                    p.status(),
                    "reason",
                    Objects.toString(p.closeoutReason(), ""),
                    "definition",
                    policy.definition(p)))
            .getBytes(StandardCharsets.UTF_8));
    files.put("执行监控与调整记录.json", policy.write(monitor(project)).getBytes(StandardCharsets.UTF_8));
    if (mapper.countHistory(t(), project) > 1000)
      throw new IllegalStateException("项目调整历史超过1000条，请先分页导出调整记录并按分包下载档案");
    files.put(
        "调整历史.json", policy.write(mapper.history(t(), project)).getBytes(StandardCharsets.UTF_8));
    var ids = new LinkedHashSet<String>();
    ids.add(project);
    if(lifecycle.count(t(),project)>1000)throw new IllegalStateException("承接清算历史超过1000条，请先分页导出");
    var lifecycleHistory=lifecycle.page(t(),project,1000,0);
    if(!lifecycleHistory.isEmpty())files.put("跨年度承接与终止清算.json",policy.write(lifecycleHistory).getBytes(StandardCharsets.UTF_8));
    for(var r:lifecycleHistory)ids.add(r.id());
    for (var run : expansions.activeRuns(p)) ids.add(run.executionId());
    for (var d : projects.demands(t(), project)) ids.add(d.id());
    for (var c : lots.changes(t(), project, Integer.MAX_VALUE, 0)) ids.add(c.id());
    for (var l : lots.packages(t(), project))
      for (var r : lots.runs(t(), l.id())) ids.add(r.executionId());
    files.put(
        "审批历史.json",
        policy
            .write(workflow.procurementExecutionHistory(new ArrayList<>(ids)))
            .getBytes(StandardCharsets.UTF_8));
    var owners = new ArrayList<Map.Entry<String, String>>();
    owners.add(Map.entry("procurement_project", project));
    for (var d : projects.demands(t(), project)) {
      owners.add(Map.entry("demand", d.id()));
      owners.add(Map.entry("purchase_demand", d.id()));
    }
    for (var c : lots.changes(t(), project, Integer.MAX_VALUE, 0))
      owners.add(Map.entry("procurement_project_change", c.id()));
    for (var l : lots.packages(t(), project))
      for (var r : lots.runs(t(), l.id()))
        if ("rfq".equals(r.executionType())) owners.add(Map.entry("rfq", r.executionId()));
    var seen = new HashSet<String>();
    var manifest = new ArrayList<Map<String, Object>>();
    long total = files.values().stream().mapToLong(b -> b.length).sum();
    for (var owner : owners)
      for (var a :
          attachments.listCurrentTenantAttachmentEntities(owner.getKey(), owner.getValue()))
        if (seen.add(a.id())) {
          if (seen.size() > 1000) throw new IllegalStateException("项目原件超过1000个，请按分包下载");
          var object = attachments.loadCurrentTenantObject(a.id());
          total += object.data().length;
          if (total > 100L * 1024 * 1024) throw new IllegalStateException("整项目档案超过100MB，请按分包下载");
          String path =
              String.format(
                  "项目原件/%03d-%s", seen.size(), a.fileName().replaceAll("[^\\p{L}\\p{N}._ -]", "_"));
          files.put(path, object.data());
          manifest.add(
              Map.of(
                  "id",
                  a.id(),
                  "ownerType",
                  a.ownerType(),
                  "ownerId",
                  a.ownerId(),
                  "fileName",
                  a.fileName(),
                  "path",
                  path,
                  "sha256",
                  com.procurement.sourcing.application.ProcurementExecutionArchiveWriter.sha256(
                      object.data())));
        }
    files.put("附件台账.json", policy.write(manifest).getBytes(StandardCharsets.UTF_8));
    int n = 0;
    for (var run : expansions.activeRuns(p)) {
      expansions.requireRun(run, false);
      String rfq = expansions.rfq(run);
      if (rfq == null) throw new IllegalStateException("采购执行缺少履约锚点");
      byte[] bytes = executions.downloadCurrentProjectArchive(rfq);
      total += bytes.length;
      if (total > 100L * 1024 * 1024) throw new IllegalStateException("整项目档案超过100MB，请按分包下载");
      files.put(
          String.format("分包/%03d-%s.zip", ++n, run.executionId().replaceAll("[^a-zA-Z0-9-]", "_")),
          bytes);
    }
    var sums = new StringBuilder();
    for (var e : files.entrySet())
      sums.append(
              com.procurement.sourcing.application.ProcurementExecutionArchiveWriter.sha256(
                  e.getValue()))
          .append("  ")
          .append(e.getKey())
          .append("\n");
    files.put("SHA256SUMS.txt", sums.toString().getBytes(StandardCharsets.UTF_8));
    try {
      var out = new ByteArrayOutputStream();
      try (var zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
        for (var e : files.entrySet()) {
          var entry = new ZipEntry(e.getKey());
          entry.setTime(0);
          zip.putNextEntry(entry);
          zip.write(e.getValue());
          zip.closeEntry();
        }
      }
      return out.toByteArray();
    } catch (IOException e) {
      throw new IllegalStateException("项目档案生成失败", e);
    }
  }
}
