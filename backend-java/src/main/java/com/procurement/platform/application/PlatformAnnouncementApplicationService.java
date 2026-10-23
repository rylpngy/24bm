package com.procurement.platform.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.platform.api.CreatePlatformAnnouncementRequest;
import com.procurement.platform.api.PlatformAnnouncementResponse;
import com.procurement.platform.api.UpdatePlatformAnnouncementRequest;
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

  public List<PlatformAnnouncementResponse> listForManagement() {
    return platformAnnouncementMapper.listForManagement().stream().map(this::toResponse).toList();
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
        AuditTargetType.PLATFORM_ANNOUNCEMENT,
        announcementId);
    return toResponse(platformAnnouncementMapper.findById(announcementId));
  }

  @Transactional
  public PlatformAnnouncementResponse update(String announcementId, UpdatePlatformAnnouncementRequest request) {
    platformAnnouncementAudiencePolicy.requireSupported(request.audience());
    requireActiveAnnouncement(announcementId);
    int updated = platformAnnouncementMapper.updateContent(
        announcementId,
        request.title(),
        request.content(),
        request.audience(),
        PlatformAnnouncementStatus.ACTIVE);
    if (updated == 0) {
      throw new IllegalStateException("Platform announcement status changed before update could be applied: " + announcementId);
    }
    auditLogApplicationService.recordTenantAction(
        null,
        PlatformAnnouncementAuditAction.UPDATED,
        AuditTargetType.PLATFORM_ANNOUNCEMENT,
        announcementId);
    return toResponse(platformAnnouncementMapper.findById(announcementId));
  }

  @Transactional
  public PlatformAnnouncementResponse withdraw(String announcementId) {
    requireActiveAnnouncement(announcementId);
    int updated = platformAnnouncementMapper.updateStatus(
        announcementId,
        PlatformAnnouncementStatus.ACTIVE,
        PlatformAnnouncementStatus.WITHDRAWN);
    if (updated == 0) {
      throw new IllegalStateException("Platform announcement status changed before withdraw could be applied: " + announcementId);
    }
    auditLogApplicationService.recordTenantAction(
        null,
        PlatformAnnouncementAuditAction.WITHDRAWN,
        AuditTargetType.PLATFORM_ANNOUNCEMENT,
        announcementId);
    return toResponse(platformAnnouncementMapper.findById(announcementId));
  }

  private void requireActiveAnnouncement(String announcementId) {
    PlatformAnnouncement announcement = platformAnnouncementMapper.findById(announcementId);
    if (announcement == null) {
      throw new IllegalArgumentException("Platform announcement not found: " + announcementId);
    }
    if (!PlatformAnnouncementStatus.ACTIVE.equals(announcement.status())) {
      throw new IllegalStateException("Platform announcement is not active: " + announcementId);
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
