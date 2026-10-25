package com.procurement.buyer.application;

import com.procurement.attachment.application.AttachmentOwnerAccess;
import com.procurement.buyer.infrastructure.ProjectExpansionMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public record ProjectChangeAttachmentAccess(
    ProcurementProjectGuard guard, ProjectExpansionMapper mapper) implements AttachmentOwnerAccess {
  public Set<String> ownerTypes() {
    return Set.of("procurement_project_change");
  }

  public void requireAccess(String id, boolean write) {
    var c = mapper.change(TenantAccessGuard.requireTenantId("project change"), id);
    if (c == null) throw new IllegalArgumentException("变更申请不存在");
    var project=guard.require(c.projectId(), write);
    if(write&&!"approved".equals(project.status()))throw new IllegalStateException("项目已结束，变更附件不可改写");
    if (write && !Set.of("draft", "rejected", "withdrawn").contains(c.status()))
      throw new IllegalStateException("已提交变更的附件不能改写");
  }
}
