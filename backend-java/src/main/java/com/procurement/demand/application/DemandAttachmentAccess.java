package com.procurement.demand.application;

import com.procurement.attachment.application.AttachmentOwnerAccess;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public record DemandAttachmentAccess(PurchaseDemandMapper mapper, PermissionService permissions,
    DataScopeService scopes) implements AttachmentOwnerAccess {
  public Set<String> ownerTypes() { return Set.of("demand", "purchase_demand"); }

  public void requireAccess(String id, boolean write) {
    permissions.require(write ? "buyer:demand:create" : "buyer:demand:read");
    var demand = mapper.findByTenantAndId(TenantAccessGuard.requireTenantId("demand attachment"), id);
    if (demand == null) throw new PermissionDeniedException("采购需求不存在或无权访问");
    scopes.requireRecordAccess(demand.departmentId(), demand.requesterId());
  }
}
