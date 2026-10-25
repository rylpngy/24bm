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

  public ProcurementProjectGuard(
      ProcurementProjectMapper mapper,
      DataScopeService scopes,
      PermissionService permissions,
      BudgetControlService budget) {
    this.mapper = mapper;
    this.scopes = scopes;
    this.permissions = permissions;
    this.budget = budget;
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
    var expected = mapper.demands(t, p.id()).stream().map(d -> d.id()).sorted().toList();
    if (!expected.equals(demands.stream().distinct().sorted().toList()))
      throw new IllegalStateException("本轮项目按完整需求集合下发，请在项目库核对关联需求");
    if (p.executionId() != null) throw new IllegalStateException("项目已有采购执行，不能重复下发");
    if (mapper.bindExecution(t, p.id(), "rfq", rfq) != 1)
      throw new IllegalStateException("项目状态变化，请刷新");
  }

  public void requireExecution(String type, String execution) {
    String t = TenantAccessGuard.requireTenantId("project execution");
    String id = mapper.executionProject(t, type, execution);
    if (id != null) approved(require(id, false));
  }

  public List<String> tenderDemands(String tender) {
    String t = TenantAccessGuard.requireTenantId("project tender");
    String id = mapper.executionProject(t, "tender", tender);
    if (id == null) return List.of();
    var p = require(id, false);
    approved(p);
    var demands = mapper.demands(t, id);
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
    return mapper.projectForRfq(TenantAccessGuard.requireTenantId("project archive"), rfq);
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
