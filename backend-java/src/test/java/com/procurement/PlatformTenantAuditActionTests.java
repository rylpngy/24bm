package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.platform.domain.PlatformTenantAuditAction;
import org.junit.jupiter.api.Test;

class PlatformTenantAuditActionTests {

  @Test
  void definesPlatformTenantAuditActions() {
    assertThat(PlatformTenantAuditAction.CREATED).isEqualTo("tenant.created");
    assertThat(PlatformTenantAuditAction.FEATURES_UPDATED).isEqualTo("tenant.features.updated");
    assertThat(PlatformTenantAuditAction.PLAN_UPDATED).isEqualTo("tenant.plan_updated");
    assertThat(PlatformTenantAuditAction.ENABLED).isEqualTo("tenant.enabled");
    assertThat(PlatformTenantAuditAction.DISABLED).isEqualTo("tenant.disabled");
  }
}
