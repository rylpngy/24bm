package com.procurement.buyer.application;

import com.procurement.attachment.application.AttachmentOwnerAccess;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public record ProjectAttachmentAccess(ProcurementProjectGuard guard)
    implements AttachmentOwnerAccess {
  public Set<String> ownerTypes() {
    return Set.of("procurement_project");
  }

  public void requireAccess(String id, boolean write) {
    var p = guard.require(id, write);
    if (write && !Set.of("draft", "rejected", "withdrawn").contains(p.status()))
      throw new IllegalStateException("仅草稿、驳回、撤回项目可维护附件");
  }
}
