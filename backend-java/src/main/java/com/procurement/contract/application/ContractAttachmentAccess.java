package com.procurement.contract.application;

import com.procurement.attachment.application.AttachmentOwnerAccess;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.contract.infrastructure.ContractMapper;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public record ContractAttachmentAccess(ContractMapper mapper, PermissionService permissions,
    DataScopeService scopes) implements AttachmentOwnerAccess {
  public Set<String> ownerTypes() { return Set.of("contract"); }

  public void requireAccess(String id, boolean write) {
    permissions.require(write ? "buyer:contract:manage" : "buyer:contract:read");
    String tenant = TenantAccessGuard.requireTenantId("contract attachment");
    var scope = scopes.currentUserDataScope();
    if (scope.blocksAll() || !mapper.canAccessAttachment(tenant, id,
        scope.restricted() && scope.requesterId() == null ? scope.departmentIds() : null,
        scope.restricted() ? scope.requesterId() : null)) {
      throw new PermissionDeniedException("合同不存在或无权访问");
    }
  }
}
