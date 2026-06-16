package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.platform.domain.PlatformTenantStatus;
import org.junit.jupiter.api.Test;

class PlatformTenantStatusTests {

  @Test
  void definesActiveAndInactiveTenantStatuses() {
    assertThat(PlatformTenantStatus.ACTIVE).isEqualTo("active");
    assertThat(PlatformTenantStatus.INACTIVE).isEqualTo("inactive");
  }
}
