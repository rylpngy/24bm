package com.procurement.platform.application;

import com.procurement.platform.api.PublicAnnouncementResponse;
import com.procurement.platform.api.PublicSupplierResponse;
import com.procurement.platform.domain.PlatformAnnouncement;
import com.procurement.platform.infrastructure.PlatformAnnouncementMapper;
import com.procurement.platform.infrastructure.PlatformEnterpriseMapper;
import java.util.List;
import org.springframework.stereotype.Service;

// 公开门户只读聚合:认证供应商名录 + 生效公告。无租户上下文,仅暴露公开安全字段。
@Service
public class PublicPortalApplicationService {
  private final PlatformEnterpriseMapper platformEnterpriseMapper;
  private final PlatformAnnouncementMapper platformAnnouncementMapper;

  public PublicPortalApplicationService(
      PlatformEnterpriseMapper platformEnterpriseMapper,
      PlatformAnnouncementMapper platformAnnouncementMapper) {
    this.platformEnterpriseMapper = platformEnterpriseMapper;
    this.platformAnnouncementMapper = platformAnnouncementMapper;
  }

  public List<PublicSupplierResponse> listPublicSuppliers() {
    return platformEnterpriseMapper.listPublicSuppliers();
  }

  public PublicSupplierResponse getPublicSupplier(String enterpriseId) {
    PublicSupplierResponse supplier = platformEnterpriseMapper.findPublicSupplierById(enterpriseId);
    if (supplier == null) {
      throw new IllegalArgumentException("供应商不存在或未通过平台认证: " + enterpriseId);
    }
    return supplier;
  }

  public List<PublicAnnouncementResponse> listActiveAnnouncements() {
    return platformAnnouncementMapper.listActive().stream().map(this::toResponse).toList();
  }

  public PublicAnnouncementResponse getActiveAnnouncement(String announcementId) {
    PlatformAnnouncement announcement = platformAnnouncementMapper.findById(announcementId);
    if (announcement == null || !"active".equals(announcement.status())) {
      throw new IllegalArgumentException("公告不存在或已撤回: " + announcementId);
    }
    return toResponse(announcement);
  }

  private PublicAnnouncementResponse toResponse(PlatformAnnouncement a) {
    return new PublicAnnouncementResponse(a.id(), a.title(), a.content(), a.audience(), a.createdAt());
  }
}
