package com.procurement.ludongpoc.application;

import com.procurement.attachment.application.AttachmentOwnerAccess;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.ludongpoc.infrastructure.LudongPocApplicationMapper;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public record LudongAttachmentAccess(LudongPocApplicationMapper mapper, PermissionService permissions,
    DataScopeService scopes) implements AttachmentOwnerAccess {
  public Set<String> ownerTypes() {
    return LudongPocArchiveMaterialCatalog.supported().stream().map(LudongPocArchiveMaterialCatalog.Category::ownerType)
        .collect(java.util.stream.Collectors.toSet());
  }

  public void requireAccess(String id, boolean write) {
    if (write) permissions.require("buyer:ludong-poc:write");
    else if (!permissions.currentUserHas("buyer:ludong-poc:read")
        && !permissions.currentUserHas("buyer:ludong-poc:review")
        && !permissions.currentUserHas("buyer:ludong-poc:export")) permissions.require("buyer:ludong-poc:write");
    var application = mapper.findByTenantAndId(TenantAccessGuard.requireTenantId("Ludong attachment"), id);
    if (application == null) throw new PermissionDeniedException("申报不存在或无权访问");
    scopes.requireRecordAccess(application.departmentId(), application.createdBy());
  }
}
