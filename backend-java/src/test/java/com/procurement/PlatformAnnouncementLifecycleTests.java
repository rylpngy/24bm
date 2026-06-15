package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.platform.api.CreatePlatformAnnouncementRequest;
import com.procurement.platform.application.PlatformAnnouncementApplicationService;
import com.procurement.platform.domain.PlatformAnnouncement;
import com.procurement.platform.infrastructure.PlatformAnnouncementMapper;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PlatformAnnouncementLifecycleTests {

  private final PlatformAnnouncementMapper platformAnnouncementMapper =
      org.mockito.Mockito.mock(PlatformAnnouncementMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final PlatformAnnouncementApplicationService platformAnnouncementApplicationService =
      new PlatformAnnouncementApplicationService(platformAnnouncementMapper, auditLogApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void publishPlatformAnnouncementRecordsPlatformAuditLog() {
    TenantContext.set(null, null, "user-platform-admin");
    when(platformAnnouncementMapper.findById(org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> announcement(invocation.getArgument(0)));

    platformAnnouncementApplicationService.publish(new CreatePlatformAnnouncementRequest(
        "系统维护通知",
        "6 月 20 日 22:00-23:00 进行例行维护。",
        "all"));

    verify(platformAnnouncementMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("announcement-")),
        org.mockito.ArgumentMatchers.eq("系统维护通知"),
        org.mockito.ArgumentMatchers.eq("6 月 20 日 22:00-23:00 进行例行维护。"),
        org.mockito.ArgumentMatchers.eq("all"),
        org.mockito.ArgumentMatchers.eq("active"),
        org.mockito.ArgumentMatchers.eq("user-platform-admin"));
    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.eq("platform_announcement.published"),
        org.mockito.ArgumentMatchers.eq("platform_announcement"),
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("announcement-")));
  }

  @Test
  void publishPlatformAnnouncementRejectsUnsupportedAudience() {
    org.assertj.core.api.Assertions.assertThatThrownBy(() ->
            platformAnnouncementApplicationService.publish(new CreatePlatformAnnouncementRequest(
                "系统维护通知",
                "6 月 20 日 22:00-23:00 进行例行维护。",
                "tenant")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported platform announcement audience");
  }

  private PlatformAnnouncement announcement(String id) {
    return new PlatformAnnouncement(
        id,
        "系统维护通知",
        "6 月 20 日 22:00-23:00 进行例行维护。",
        "all",
        "active",
        "user-platform-admin",
        OffsetDateTime.parse("2026-06-16T10:00:00+08:00"));
  }
}
