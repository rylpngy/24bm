package com.procurement.buyer.application;

import com.procurement.buyer.api.ProjectContracts.Project;
import com.procurement.buyer.infrastructure.ProcurementProjectMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProcurementProjectGuard {
  private final ProcurementProjectMapper mapper;
  private final DataScopeService scopes;
  private final PermissionService permissions;
  private final BudgetControlService budget;
  private final com.procurement.buyer.infrastructure.ProjectExpansionMapper expansion;
  private final ProjectAllocationPolicy allocations;

  public ProcurementProjectGuard(
      ProcurementProjectMapper mapper,
      DataScopeService scopes,
      PermissionService permissions,
      BudgetControlService budget,
      com.procurement.buyer.infrastructure.ProjectExpansionMapper expansion,
      ProjectAllocationPolicy allocations) {
    this.mapper = mapper;
    this.scopes = scopes;
    this.permissions = permissions;
    this.budget = budget;
    this.expansion = expansion;
    this.allocations = allocations;
  }

  @Transactional
  public void lock() {
    String t = TenantAccessGuard.requireTenantId("project");
    budget.lock(t);
    mapper.lock(t);
  }

  public Project require(String id, boolean write) {
    String t = TenantAccessGuard.requireTenantId("project");
    permissions.require(write ? "buyer:project:manage" : "buyer:project:read");
    var p = mapper.find(t, id);
    if (p == null) throw new IllegalArgumentException("项目不存在");
    scopes.requireRecordAccess(p.departmentId(), p.createdBy());
    return p;
  }

  public void approved(Project p) {
    if (!"approved".equals(p.status())) throw new IllegalStateException("项目未批准或已终止/结项，不能发起采购");
  }

  @Transactional
  public void bindRfq(List<String> demands, String rfq) {
    String t = TenantAccessGuard.requireTenantId("project execution");
    Set<String> projects = new HashSet<>();
    boolean unlinked = false;
    for (String id : demands) {
      String p = mapper.demandProject(t, id);
      if (p == null) unlinked = true;
      else projects.add(p);
    }
    if (projects.isEmpty()) return;
    lock();
    if (projects.size() != 1 || unlinked) throw new IllegalStateException("不能跨项目或混合未关联需求创建采购执行");
    var p = require(projects.iterator().next(), true);
    approved(p);
    allocations.noPending(p);
    var lots =
        demands.stream()
            .map(d -> expansion.demandLot(t, d))
            .filter(Objects::nonNull)
            .distinct()
            .toList();
    if (!lots.isEmpty()) {
      if (lots.size() != 1
          || demands.stream().anyMatch(d -> !lots.getFirst().equals(expansion.demandLot(t, d))))
        throw new IllegalStateException("不能混合不同分包或未分包需求");
      var lot = expansion.lot(t, lots.getFirst());
      if (!"ready".equals(lot.status())
          || expansion.runs(t, lot.id()).stream().anyMatch(r -> "active".equals(r.status())))
        throw new IllegalStateException("分包已有有效执行或不在待采购状态");
      if (!expansion.lotDemands(t, lot.id()).equals(demands.stream().distinct().sorted().toList()))
        throw new IllegalStateException("请完整选择该分包的需求");
      allocations.validateLotDemands(lot);
      expansion.insertRun(
          t,
          p.id(),
          lot.id(),
          "project-run-" + UUID.randomUUID(),
          "rfq",
          rfq,
          TenantAccessGuard.requireUserId("project"));
      expansion.lotState(t, lot.id(), lot.revision(), "ready");
      mapper.state(t, p.id(), p.revision(), p.status(), null, p.closeoutReason());
      return;
    }
    if (!expansion.packages(t, p.id()).isEmpty())
      throw new IllegalStateException("项目已采用分包管理，请通过具体分包下发采购");
    var expected = mapper.demands(t, p.id()).stream().map(d -> d.id()).sorted().toList();
    if (!expected.equals(demands.stream().distinct().sorted().toList()))
      throw new IllegalStateException("本轮项目按完整需求集合下发，请在项目库核对关联需求");
    if (p.executionId() != null) throw new IllegalStateException("项目已有采购执行，不能重复下发");
    if (mapper.bindExecution(t, p.id(), "rfq", rfq) != 1)
      throw new IllegalStateException("项目状态变化，请刷新");
  }

  public void requireExecution(String type, String execution) {
    String t = TenantAccessGuard.requireTenantId("project execution");
    var run = expansion.run(t, type, execution);
    if (run != null) {
      approved(require(run.projectId(), false));
      if (!"active".equals(run.status())) throw new IllegalStateException("该执行已被替换，只能查看历史");
      allocations.validateLotDemands(expansion.lot(t, run.packageId()));
      return;
    }
    String id = mapper.executionProject(t, type, execution);
    if (id != null) approved(require(id, false));
  }

  public List<String> tenderDemands(String tender) {
    String t = TenantAccessGuard.requireTenantId("project tender");
    var run = expansion.run(t, "tender", tender);
    if (run != null) {
      approved(require(run.projectId(), false));
      if (!"active".equals(run.status())) throw new IllegalStateException("该执行已被替换");
      var ids = expansion.lotDemands(t, run.packageId());
      for (var demand : ids) {
        var d = mapper.demand(t, demand);
        scopes.requireRecordAccess(d.departmentId(), d.requesterId());
      }
      return ids;
    }
    String id = mapper.executionProject(t, "tender", tender);
    if (id == null) return List.of();
    var p = require(id, false);
    approved(p);
    var legacyIds = allocations.legacyDemands(p);
    var demands = mapper.demands(t, id).stream().filter(d -> legacyIds.contains(d.id())).toList();
    if (demands.isEmpty()) throw new IllegalStateException("招标项目缺少关联需求");
    return demands.stream()
        .map(
            d -> {
              scopes.requireRecordAccess(d.departmentId(), d.requesterId());
              return d.id();
            })
        .toList();
  }

  public String projectForRfq(String rfq) {
    String t = TenantAccessGuard.requireTenantId("project archive");
    var run = expansion.runForRfq(t, rfq);
    return run == null ? mapper.projectForRfq(t, rfq) : run.projectId();
  }

  public com.fasterxml.jackson.databind.JsonNode archiveDefinitionForRfq(String rfq) {
    String t = TenantAccessGuard.requireTenantId("project archive");
    var run = expansion.runForRfq(t, rfq);
    String id = projectForRfq(rfq);
    if (id == null) return null;
    var p = require(id, false);
    String snapshot =
        run == null
            ? expansion.baseline(t, p.executionType(), p.executionId())
            : expansion.lot(t, run.packageId()).snapshot();
    if (snapshot == null) return allocations.json().valueToTree(archiveDefinition(id));
    return allocations.tree(snapshot);
  }

  public void requireStandaloneRebid(String tender) {
    String t = TenantAccessGuard.requireTenantId("project retry");
    if (expansion.run(t, "tender", tender) != null)
      throw new IllegalStateException("关联项目分包请在项目库中保留历史并重采");
  }

  public Map<String, Object> archiveDefinition(String id) {
    var p = require(id, false);
    var result = new LinkedHashMap<String, Object>();
    result.put("id", p.id());
    result.put("projectNo", p.projectNo());
    result.put("title", p.title());
    result.put("departmentId", p.departmentId());
    result.put("ownerId", p.ownerId());
    result.put("period", p.period());
    result.put("fundingSource", p.fundingSource());
    result.put("plannedAmount", p.plannedAmount());
    result.put("purpose", p.purpose());
    result.put("lines", mapper.lines(p.tenantId(), id));
    return result;
  }
}
