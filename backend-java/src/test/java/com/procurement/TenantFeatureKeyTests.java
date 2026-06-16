package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.tenant.domain.TenantFeatureKey;
import org.junit.jupiter.api.Test;

class TenantFeatureKeyTests {
  @Test
  void definesTenantFeatureKeys() {
    assertThat(TenantFeatureKey.RFQ).isEqualTo("rfq");
    assertThat(TenantFeatureKey.ORDER).isEqualTo("order");
    assertThat(TenantFeatureKey.FINANCE).isEqualTo("finance");
  }
}
