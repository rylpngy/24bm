package com.procurement.platform.domain;

import org.springframework.stereotype.Component;

@Component
public class PlatformAnnouncementAudiencePolicy {

  public void requireSupported(String audience) {
    if (!PlatformAnnouncementAudience.ALL.equals(audience)
        && !PlatformAnnouncementAudience.BUYER.equals(audience)
        && !PlatformAnnouncementAudience.SUPPLIER.equals(audience)) {
      throw new IllegalArgumentException("Unsupported platform announcement audience: " + audience);
    }
  }
}
