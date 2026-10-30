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
    DataScopeService scopes, com.procurement.tender.infrastructure.TenderDocumentReviewMapper reviews) implements AttachmentOwnerAccess {
  public Set<String> ownerTypes() { return Set.of("tender"); }

  public void requireAccess(String id, boolean write) {
    permissions.require(write ? "buyer:tender:manage" : "buyer:tender:read");
    var tender = mapper.findByTenantAndId(TenantAccessGuard.requireTenantId("tender attachment"), id);
    if (tender == null) throw new PermissionDeniedException("招标项目不存在或无权访问");
    scopes.requireCreatorAccess(tender.ownerId());
    if(write) {
      var locked=mapper.lockByTenantAndId(tender.tenantId(),id);
      if(!com.procurement.tender.domain.TenderPolicy.STATUS_DRAFTING.equals(locked.status()))
        throw new IllegalStateException("已发布的采购文件附件不可直接变更");
      if(reviews.list(tender.tenantId(),id).stream().anyMatch(r->r.status().equals("processing")))
        throw new IllegalStateException("采购文件审查中，不能修改文件或附件");
    }
  }
}
