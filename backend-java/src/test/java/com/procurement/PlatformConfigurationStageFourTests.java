package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.dictionary.api.SaveDictionaryEntryRequest;
import com.procurement.dictionary.application.DictionaryApplicationService;
import com.procurement.dictionary.infrastructure.DictionaryMapper;
import com.procurement.platform.api.FeatureToggleRequest;
import com.procurement.platform.api.UpdateTenantPlanRequest;
import com.procurement.platform.application.PlatformTenantApplicationService;
import com.procurement.platform.domain.PlatformTenant;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import com.procurement.platform.infrastructure.TenantPlanChangeMapper;
import com.procurement.tenant.domain.ProcurementMethodCatalog;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class PlatformConfigurationStageFourTests {
  final PlatformTenantMapper tenants = mock(PlatformTenantMapper.class);
  final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  final TenantPlanChangeMapper changes = mock(TenantPlanChangeMapper.class);
  final PlatformTenantApplicationService service = new PlatformTenantApplicationService(
      tenants, new ObjectMapper(), audit, mock(PasswordEncoder.class), changes);

  @AfterEach void clear() { TenantContext.clear(); }

  @Test void rejectsUnknownNullDuplicateAndContradictoryFeaturesBeforeWrite() {
    for (List<String> features : List.of(List.of("unknown"), List.of("rfq", "rfq"),
        Arrays.asList("rfq", null), List.of("method:none", "method:mall"))) {
      assertThatThrownBy(() -> service.updateFeatureToggles("t", new FeatureToggleRequest(features)))
          .isInstanceOf(IllegalArgumentException.class);
    }
    verifyNoInteractions(tenants, audit);
  }

  @Test void explicitNoneDoesNotFallBackToAllButLegacyFeaturesStillDo() {
    assertThat(ProcurementMethodCatalog.enabledMethods(List.of("method:none"))).isEmpty();
    assertThat(ProcurementMethodCatalog.enabledMethods(List.of("rfq", "mall", "contract"))).hasSize(5);
  }

  @Test void explicitNoneCannotBeCombinedWithLegacyMall() {
    assertThat(ProcurementMethodCatalog.enabledMethods(List.of("mall", "method:none"))).isEmpty();
  }

  @Test void recognizedLegacyFeaturesRemainValidWithoutChangingTheirMeaning() {
    assertThatCode(() -> com.procurement.tenant.domain.TenantFeatureKey.validate(List.of("workflow", "ludong-poc", "contract", "mall")))
        .doesNotThrowAnyException();
  }

  @Test void catalogDoesNotPresentLegacyMarkersAsNewlyEnforcedSwitches() {
    var json = new ObjectMapper().valueToTree(new com.procurement.platform.api.PlatformTenantController(service)
        .configurationCatalog().data());
    for (var feature : json.path("features")) {
      if (feature.path("key").asText().equals("contract") || feature.path("key").asText().equals("mall")) {
        assertThat(feature.path("configurable").asBoolean(true)).isFalse();
      }
    }
  }

  @Test void canonicalizesChinesePlanAliasesWithoutRewritingHistory() {
    TenantContext.set(null, null, "operator");
    when(tenants.findById("t")).thenReturn(new PlatformTenant("t", "T", "MVP", "active", "[]", 3));
    when(tenants.updatePlan("t", "Growth", 10)).thenReturn(1);
    when(tenants.updatePlan("t", "标准版", 10)).thenReturn(1);
    service.updateTenantPlan("t", new UpdateTenantPlanRequest("标准版", 10));
    verify(tenants).updatePlan("t", "Growth", 10);
    verify(changes).insert(anyString(), eq("t"), eq("MVP"), eq("Growth"), eq(3), eq(10), eq("operator"));
  }

  @Test void unknownPlanFailsBeforeDatabaseAccess() {
    assertThatThrownBy(() -> service.updateTenantPlan("t", new UpdateTenantPlanRequest("unlimited", 10)))
        .isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(tenants);
  }

  @Test void fixedDictionaryCodesCannotInventBusinessStates() {
    DictionaryMapper mapper = mock(DictionaryMapper.class);
    DictionaryApplicationService dictionaries = new DictionaryApplicationService(mapper, audit, new ObjectMapper());
    assertThatThrownBy(() -> dictionaries.create(
        new SaveDictionaryEntryRequest("announcement_audience", "vip", "VIP", 0, "active")))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> dictionaries.create(
        new SaveDictionaryEntryRequest("payment_status", "refunded", "Refunded", 0, "active")))
        .isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(mapper);
  }
}
