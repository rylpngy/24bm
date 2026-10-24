package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.common.tenant.TenantContext;
import com.procurement.tenant.api.BuyerCapabilityController;
import com.procurement.tenant.application.TenantCapabilityApplicationService;
import com.procurement.tenant.infrastructure.TenantFeatureMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class TenantCapabilityStageFourTests {
  @AfterEach void clear() { TenantContext.clear(); }
  @Test void responseDistinguishesNewBusinessGatesFromHistoricalModules() {
    TenantContext.set("t", null, "u");
    var mapper = mock(TenantFeatureMapper.class);
    when(mapper.findEnabledFeaturesJson("t")).thenReturn("[\"method:none\"]");
    var controller = new BuyerCapabilityController(new TenantCapabilityApplicationService(mapper, new ObjectMapper()));
    var json = new ObjectMapper().valueToTree(controller.capabilities().data());
    assertThat(json.path("methods").size()).isZero();
    assertThat(json.path("enabledFeatures").toString()).isEqualTo("[\"method:none\"]");
    assertThat(json.path("newBusinessModuleIds").isArray()).isTrue();
    assertThat(json.path("newBusinessModuleIds").size()).isZero();
    assertThat(json.path("historicalModuleIds").toString()).contains("orders", "invoices");
    verify(mapper, times(1)).findEnabledFeaturesJson("t");
  }

  @Test void effectiveMethodsRequireTheExistingRfqModuleButKeepLegacyMethodInheritance() {
    assertThat(TenantCapabilityApplicationService.effectiveMethods(java.util.List.of("rfq", "order", "finance"))).hasSize(5);
    assertThat(TenantCapabilityApplicationService.effectiveMethods(java.util.List.of("order", "finance")))
        .extracting(m -> m.featureKey()).containsExactly("method:mall", "method:tender");
    assertThat(TenantCapabilityApplicationService.newBusinessModuleIds(java.util.List.of("rfq", "order", "finance")))
        .contains("orders", "invoices", "rfqs", "auctions", "mall", "tenders");
  }

  @Test void historyGuardCannotBeUsedToBypassOtherModulesOrMissingTenants() {
    var mapper = mock(TenantFeatureMapper.class);
    when(mapper.findEnabledFeaturesJson("t")).thenReturn("[]");
    var features = new com.procurement.tenant.application.TenantFeatureApplicationService(mapper, new ObjectMapper());
    assertThatCode(() -> features.requireHistoricalFulfillment("t", "order")).doesNotThrowAnyException();
    assertThatCode(() -> features.requireHistoricalFulfillment("t", "finance")).doesNotThrowAnyException();
    assertThatThrownBy(() -> features.requireHistoricalFulfillment("t", "rfq")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> features.requireHistoricalFulfillment("missing", "order")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> features.requireEnabled("t", "order")).isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> features.requireEnabled("t", "finance")).isInstanceOf(IllegalStateException.class);
  }
}
