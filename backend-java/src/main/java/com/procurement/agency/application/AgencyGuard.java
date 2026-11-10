package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.AgencyMapper;
import com.procurement.common.tenant.*;
import com.procurement.identity.application.*;
import com.procurement.identity.domain.DataScope;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class AgencyGuard {
  private final AgencyMapper mapper;
  private final PermissionService permissions;
  private final DataScopeService scopes;

  public AgencyGuard(AgencyMapper mapper, PermissionService permissions, DataScopeService scopes) {
    this.mapper = mapper;
    this.permissions = permissions;
    this.scopes = scopes;
  }

  public AgencyMapper mapper() {
    return mapper;
  }

  public PermissionService permissions() {
    return permissions;
  }

  public DataScopeService scopes() {
    return scopes;
  }

  public String tenant() {
    return TenantAccessGuard.requireTenantId("agency");
  }

  public String actor() {
    return TenantAccessGuard.requireUserId("agency");
  }

  public boolean inScope(PackageRow p, boolean write) {
    if (!tenant().equals(p.tenantId())) return false;
    String actor = actor();
    if (actor.equals(p.createdBy()) || actor.equals(p.ownerId())) return true;
    if (mapper.members(tenant(), p.id()).stream()
        .anyMatch(m -> actor.equals(m.userId()) && (!write || !"VIEWER".equals(m.role()))))
      return true;
    DataScope scope = scopes.currentUserDataScope();
    return !scope.restricted()
        || scope.requesterId() != null && scope.requesterId().equals(p.createdBy())
        || p.departmentId() != null && scope.departmentIds().contains(p.departmentId());
  }

  public PackageRow require(String id, boolean write) {
    permissions.require(write ? "buyer:agency:manage" : "buyer:agency:read");
    PackageRow p = mapper.find(tenant(), id);
    if (p == null || !inScope(p, write)) throw new PermissionDeniedException("采购包不存在或超出授权范围");
    return p;
  }

  public void mutable(PackageRow p) {
    if (p.workflowId() != null || "reviewing".equals(p.status()))
      throw new IllegalStateException("档案审批中，须撤回或退回后才能修改");
  }

  public PackageRow requireApproved(String id) {
    PackageRow p = require(id, true);
    if (!"approved".equals(p.status()) || p.workflowId() != null)
      throw new IllegalStateException("建档尚未通过或存在待审变更，禁止开展下游业务");
    if (!"half".equals(p.operatingMode())) throw new IllegalStateException("全流程尚未开放");
    return p;
  }

  public boolean can(PackageRow p, String permission, boolean write) {
    return permissions.currentUserHas(permission) && inScope(p, write);
  }
}
