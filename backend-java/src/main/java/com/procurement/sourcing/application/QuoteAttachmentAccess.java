package com.procurement.sourcing.application;

import com.procurement.attachment.application.AttachmentOwnerAccess;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public record QuoteAttachmentAccess(QuoteMapper quotes, RfqMapper rfqs, PermissionService permissions,
    DataScopeService scopes) implements AttachmentOwnerAccess {
  public Set<String> ownerTypes() { return Set.of("quote"); }

  public void requireAccess(String id, boolean write) {
    permissions.require(write ? "buyer:rfq:manage" : "buyer:rfq:read");
    String tenant = TenantAccessGuard.requireTenantId("quote attachment");
    var quote = quotes.findByTenantAndId(tenant, id);
    var rfq = quote == null ? null : rfqs.findByTenantAndId(tenant, quote.rfqId());
    if (rfq == null) throw new PermissionDeniedException("报价不存在或无权访问");
    scopes.requireCreatorAccess(rfq.ownerId());
  }
}
