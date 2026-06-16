package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.platform.domain.PlatformBuyerRoleDefaults;
import org.junit.jupiter.api.Test;

class PlatformBuyerRoleDefaultsTests {
  @Test
  void definesInitialBuyerOwnerRoleForTenantOnboarding() {
    assertThat(PlatformBuyerRoleDefaults.OWNER_ROLE_NAME).isEqualTo("采购管理员");
    assertThat(PlatformBuyerRoleDefaults.OWNER_PERMISSIONS_JSON).isEqualTo("[\"buyer:*\"]");
  }
}
