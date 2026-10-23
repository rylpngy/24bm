package com.procurement.supplier.application;

import com.procurement.attachment.application.AttachmentOwnerAccess;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public record SupplierAttachmentAccess(BuyerSupplierRelationMapper mapper, PermissionService permissions)
    implements AttachmentOwnerAccess {
  public Set<String> ownerTypes() { return Set.of("supplier"); }

  public void requireAccess(String id, boolean write) {
    permissions.require(write ? "buyer:supplier:manage" : "buyer:supplier:read");
    // The private supplier library is shared within the buyer tenant, not the public supplier directory.
    if (mapper.countByTenantSupplier(TenantAccessGuard.requireTenantId("supplier attachment"), id) == 0) {
      throw new PermissionDeniedException("供应商不在当前企业合作库中");
    }
  }
}
