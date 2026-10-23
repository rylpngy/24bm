package com.procurement.tender.application;

import com.procurement.attachment.application.AttachmentOwnerAccess;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.tender.infrastructure.TenderMapper;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public record TenderAttachmentAccess(TenderMapper mapper, PermissionService permissions,
    DataScopeService scopes) implements AttachmentOwnerAccess {
  public Set<String> ownerTypes() { return Set.of("tender"); }

  public void requireAccess(String id, boolean write) {
    permissions.require(write ? "buyer:tender:manage" : "buyer:tender:read");
    var tender = mapper.findByTenantAndId(TenantAccessGuard.requireTenantId("tender attachment"), id);
    if (tender == null) throw new PermissionDeniedException("招标项目不存在或无权访问");
    scopes.requireCreatorAccess(tender.ownerId());
  }
}
