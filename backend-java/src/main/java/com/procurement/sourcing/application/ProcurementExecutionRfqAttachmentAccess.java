package com.procurement.sourcing.application;

import com.procurement.attachment.application.AttachmentOwnerAccess;
import com.procurement.order.application.OrderAccessService;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public record ProcurementExecutionRfqAttachmentAccess(OrderAccessService access) implements AttachmentOwnerAccess {
  public Set<String> ownerTypes() { return Set.of("rfq"); }
  public void requireAccess(String id, boolean write) {
    access.requireRfq(id, write ? "buyer:rfq:manage" : "buyer:rfq:read");
  }
}
