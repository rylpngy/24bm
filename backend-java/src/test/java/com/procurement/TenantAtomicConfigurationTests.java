package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.platform.api.UpdateTenantConfigurationRequest;
import com.procurement.platform.application.PlatformTenantApplicationService;
import com.procurement.platform.domain.PlatformTenant;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import com.procurement.platform.infrastructure.TenantPlanChangeMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

class TenantAtomicConfigurationTests {
  final PlatformTenantMapper mapper = mock(PlatformTenantMapper.class);
  final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  final TenantPlanChangeMapper changes = mock(TenantPlanChangeMapper.class);
  final PlatformTenantApplicationService service = new PlatformTenantApplicationService(
      mapper, new ObjectMapper(), audit, mock(PasswordEncoder.class), changes);
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void oneLockedUpdateSavesCanonicalPlanLimitAndFeaturesAndAuditsBothStates() throws Exception {
    TenantContext.set(null, null, "operator");
    when(mapper.lockById("t")).thenReturn(new PlatformTenant("t", "T", "MVP", "active", "[\"rfq\"]", 3));
    when(mapper.updateConfiguration("t", "Growth", 8, "[\"method:none\"]")).thenReturn(1);
    when(mapper.findById("t")).thenReturn(new PlatformTenant("t", "T", "Growth", "active", "[\"method:none\"]", 8));
    var result = service.updateConfiguration("t", new UpdateTenantConfigurationRequest("标准版", 8, List.of("method:none")));
    assertThat(result.plan()).isEqualTo("Growth");
    assertThat(result.enabledFeatures()).containsExactly("method:none");
    var sequence = inOrder(mapper);
    sequence.verify(mapper).lockById("t");
    sequence.verify(mapper).updateConfiguration("t", "Growth", 8, "[\"method:none\"]");
    verify(mapper, never()).updatePlan(anyString(), anyString(), anyInt());
    verify(mapper, never()).updateEnabledFeatures(anyString(), anyString());
    verify(audit).recordTenantAction(eq("t"), eq("tenant.configuration.updated"), eq("tenant"), eq("t"),
        argThat(s -> s.contains("MVP") && s.contains("Growth") && s.contains("method:none")));
    assertThat(PlatformTenantApplicationService.class.getMethod("updateConfiguration", String.class,
        UpdateTenantConfigurationRequest.class).getAnnotation(Transactional.class)).isNotNull();
  }

  @Test void invalidFeaturesPreventEveryConfigurationWrite() {
    assertThatThrownBy(() -> service.updateConfiguration("t", new UpdateTenantConfigurationRequest("MVP", 8, List.of("bad"))))
        .isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(mapper, changes, audit);
  }

  @Test void auditFailurePropagatesForTransactionRollbackRatherThanReturningSuccess() {
    TenantContext.set(null, null, "operator");
    when(mapper.lockById("t")).thenReturn(new PlatformTenant("t", "T", "MVP", "active", "[]", 3));
    when(mapper.updateConfiguration("t", "MVP", 3, "[]")).thenReturn(1);
    doThrow(new IllegalStateException("audit unavailable")).when(audit)
        .recordTenantAction(anyString(), anyString(), anyString(), anyString(), anyString());
    assertThatThrownBy(() -> service.updateConfiguration("t", new UpdateTenantConfigurationRequest("MVP", 3, List.of())))
        .hasMessage("audit unavailable");
    verify(mapper, never()).findById("t");
  }
}
