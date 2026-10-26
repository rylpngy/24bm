package com.procurement.order.application;

import com.procurement.attachment.application.AttachmentOwnerAccess;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public record OrderSettlementAttachmentAccess(OrderAccessService access)
    implements AttachmentOwnerAccess {
  public Set<String> ownerTypes() {
    return Set.of("order_settlement_document");
  }

  public void requireAccess(String id, boolean write) {
    access.requireOrder(id, write ? "buyer:order:manage" : "buyer:order:read");
  }
}
