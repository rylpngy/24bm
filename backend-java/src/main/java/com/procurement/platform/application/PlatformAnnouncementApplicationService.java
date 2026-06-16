package com.procurement.platform.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.platform.api.CreatePlatformAnnouncementRequest;
import com.procurement.platform.api.PlatformAnnouncementResponse;
import com.procurement.platform.domain.PlatformAnnouncement;
import com.procurement.platform.domain.PlatformAnnouncementAudience;
import com.procurement.platform.domain.PlatformAnnouncementAudiencePolicy;
import com.procurement.platform.domain.PlatformAnnouncementAuditAction;
import com.procurement.platform.domain.PlatformAnnouncementStatus;
import com.procurement.platform.infrastructure.PlatformAnnouncementMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformAnnouncementApplicationService {
  private static final String PLATFORM_ANNOUNCEMENT_TARGET_TYPE = "platform_announcement";

  private final PlatformAnnouncementMapper platformAnnouncementMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final PlatformAnnouncementAudiencePolicy platformAnnouncementAudiencePolicy;

  public PlatformAnnouncementApplicationService(
      PlatformAnnouncementMapper platformAnnouncementMapper,
      AuditLogApplicationService auditLogApplicationService,
      PlatformAnnouncementAudiencePolicy platformAnnouncementAudiencePolicy) {
    this.platformAnnouncementMapper = platformAnnouncementMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.platformAnnouncementAudiencePolicy = platformAnnouncementAudiencePolicy;
  }

  public List<PlatformAnnouncementResponse> listActive() {
    return platformAnnouncementMapper.listActive().stream()
        .map(this::toResponse)
        .toList();
  }

  public List<PlatformAnnouncementResponse> listBuyerVisible() {
    return platformAnnouncementMapper
        .listActiveForAudiences(PlatformAnnouncementAudience.ALL, PlatformAnnouncementAudience.BUYER)
        .stream()
        .map(this::toResponse)
        .toList();
  }

  public List<PlatformAnnouncementResponse> listSupplierVisible() {
    return platformAnnouncementMapper
        .listActiveForAudiences(PlatformAnnouncementAudience.ALL, PlatformAnnouncementAudience.SUPPLIER)
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public PlatformAnnouncementResponse publish(CreatePlatformAnnouncementRequest request) {
    platformAnnouncementAudiencePolicy.requireSupported(request.audience());
    String actorId = TenantAccessGuard.requireUserId("platform announcement APIs");
    String announcementId = "announcement-" + UUID.randomUUID();
    platformAnnouncementMapper.insert(
        announcementId,
        request.title(),
        request.content(),
        request.audience(),
        PlatformAnnouncementStatus.ACTIVE,
        actorId);
    auditLogApplicationService.recordTenantAction(
        null,
        PlatformAnnouncementAuditAction.PUBLISHED,
        PLATFORM_ANNOUNCEMENT_TARGET_TYPE,
        announcementId);
    return toResponse(platformAnnouncementMapper.findById(announcementId));
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
