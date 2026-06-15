package com.procurement.platform.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.platform.api.CreatePlatformAnnouncementRequest;
import com.procurement.platform.api.PlatformAnnouncementResponse;
import com.procurement.platform.domain.PlatformAnnouncement;
import com.procurement.platform.infrastructure.PlatformAnnouncementMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformAnnouncementApplicationService {
  private static final String ACTIVE_STATUS = "active";
  private static final String ALL_AUDIENCE = "all";
  private static final String BUYER_AUDIENCE = "buyer";
  private static final String SUPPLIER_AUDIENCE = "supplier";
  private static final String PLATFORM_ANNOUNCEMENT_PUBLISHED_ACTION = "platform_announcement.published";
  private static final String PLATFORM_ANNOUNCEMENT_TARGET_TYPE = "platform_announcement";

  private final PlatformAnnouncementMapper platformAnnouncementMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public PlatformAnnouncementApplicationService(
      PlatformAnnouncementMapper platformAnnouncementMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.platformAnnouncementMapper = platformAnnouncementMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  public List<PlatformAnnouncementResponse> listActive() {
    return platformAnnouncementMapper.listActive().stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public PlatformAnnouncementResponse publish(CreatePlatformAnnouncementRequest request) {
    requireSupportedAudience(request.audience());
    String actorId = TenantAccessGuard.requireUserId("platform announcement APIs");
    String announcementId = "announcement-" + UUID.randomUUID();
    platformAnnouncementMapper.insert(
        announcementId,
        request.title(),
        request.content(),
        request.audience(),
        ACTIVE_STATUS,
        actorId);
    auditLogApplicationService.recordTenantAction(
        null,
        PLATFORM_ANNOUNCEMENT_PUBLISHED_ACTION,
        PLATFORM_ANNOUNCEMENT_TARGET_TYPE,
        announcementId);
    return toResponse(platformAnnouncementMapper.findById(announcementId));
  }

  private void requireSupportedAudience(String audience) {
    if (!ALL_AUDIENCE.equals(audience)
        && !BUYER_AUDIENCE.equals(audience)
        && !SUPPLIER_AUDIENCE.equals(audience)) {
      throw new IllegalArgumentException("Unsupported platform announcement audience: " + audience);
    }
  }

  private PlatformAnnouncementResponse toResponse(PlatformAnnouncement announcement) {
    return new PlatformAnnouncementResponse(
        announcement.id(),
        announcement.title(),
        announcement.content(),
        announcement.audience(),
        announcement.status(),
        announcement.publishedBy(),
        announcement.createdAt());
  }
}
