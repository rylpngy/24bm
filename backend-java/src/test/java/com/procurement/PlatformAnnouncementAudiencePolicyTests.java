package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.platform.domain.PlatformAnnouncementAudience;
import com.procurement.platform.domain.PlatformAnnouncementAudiencePolicy;
import org.junit.jupiter.api.Test;

class PlatformAnnouncementAudiencePolicyTests {

  private final PlatformAnnouncementAudiencePolicy policy = new PlatformAnnouncementAudiencePolicy();

  @Test
  void supportsOnlyAllBuyerAndSupplierAudiences() {
    assertThatCode(() -> policy.requireSupported(PlatformAnnouncementAudience.ALL))
        .doesNotThrowAnyException();
    assertThatCode(() -> policy.requireSupported(PlatformAnnouncementAudience.BUYER))
        .doesNotThrowAnyException();
    assertThatCode(() -> policy.requireSupported(PlatformAnnouncementAudience.SUPPLIER))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> policy.requireSupported("tenant"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported platform announcement audience: tenant");
  }
}
