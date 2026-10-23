package com.procurement.audit.application;

import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import org.springframework.stereotype.Service;

/** Tenant-wide audit text may contain business details; actor department is not a safe record scope. */
@Service
public class AuditReadAccess {
  private final PermissionService permissions;
  private final DataScopeService scopes;
  private final com.procurement.demand.application.PurchaseDemandApplicationService demands;
  private final com.procurement.catalog.application.MaterialApplicationService materials;

  public AuditReadAccess(PermissionService permissions, DataScopeService scopes,
      com.procurement.demand.application.PurchaseDemandApplicationService demands,
      com.procurement.catalog.application.MaterialApplicationService materials) {
    this.permissions = permissions;
    this.scopes = scopes;
    this.demands = demands;
    this.materials = materials;
  }

  public boolean allowed() {
    return permissions.currentUserHas("buyer:audit:read") && !scopes.currentUserDataScope().restricted();
  }

  public void require() {
    permissions.require("buyer:audit:read");
    if (scopes.currentUserDataScope().restricted()) {
      throw new PermissionDeniedException("企业审计台账需要全部数据范围；业务历史请在有权访问的业务详情中查看");
    }
  }

  public void requireTarget(String targetType, String targetId) {
    if (allowed()) return;
    switch (targetType) {
      case "purchase_demand" -> demands.getCurrentTenantDemand(targetId);
      case "material" -> {
        permissions.require("buyer:material:read");
        String tenant = com.procurement.common.tenant.TenantAccessGuard.requireTenantId("material history");
        if (materials.findMaterialsByTenantAndIds(tenant, java.util.List.of(targetId)).isEmpty()) {
          throw new PermissionDeniedException("物料不存在或无权访问");
        }
      }
      default -> require();
    }
  }
}
