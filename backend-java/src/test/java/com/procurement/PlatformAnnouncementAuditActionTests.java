package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.platform.domain.PlatformAnnouncementAuditAction;
import org.junit.jupiter.api.Test;

class PlatformAnnouncementAuditActionTests {
  @Test
  void definesPlatformAnnouncementAuditActions() {
    assertThat(PlatformAnnouncementAuditAction.PUBLISHED)
        .isEqualTo("platform_announcement.published");
    assertThat(PlatformAnnouncementAuditAction.UPDATED)
        .isEqualTo("platform_announcement.updated");
    assertThat(PlatformAnnouncementAuditAction.WITHDRAWN)
        .isEqualTo("platform_announcement.withdrawn");
  }
}
