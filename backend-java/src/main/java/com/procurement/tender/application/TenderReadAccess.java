package com.procurement.tender.application;

import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.tender.infrastructure.TenderMapper;
import org.springframework.stereotype.Component;

/** Shared by tender-related reads without depending on the tender command service. */
@Component
public record TenderReadAccess(TenderMapper mapper, PermissionService permissions, DataScopeService scopes) {
  public boolean requireIfPresent(String id) {
    var tender = mapper.findByTenantAndId(TenantAccessGuard.requireTenantId("tender read"), id);
    if (tender == null) return false;
    permissions.require("buyer:tender:read");
    scopes.requireCreatorAccess(tender.ownerId());
    return true;
  }

  public void require(String id) {
    if (!requireIfPresent(id)) throw new PermissionDeniedException("招标项目不存在或无权访问");
  }
}
