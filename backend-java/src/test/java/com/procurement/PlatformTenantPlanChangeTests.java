package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.platform.api.UpdateTenantPlanRequest;
import com.procurement.platform.application.PlatformTenantApplicationService;
import com.procurement.platform.domain.PlatformTenant;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import com.procurement.platform.infrastructure.TenantPlanChangeMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

// 套餐升降级留痕:变更时记录前后套餐;无变化则不留痕。
class PlatformTenantPlanChangeTests {

  private final PlatformTenantMapper tenantMapper = mock(PlatformTenantMapper.class);
  private final AuditLogApplicationService auditLog = mock(AuditLogApplicationService.class);
  private final PasswordEncoder encoder = mock(PasswordEncoder.class);
  private final TenantPlanChangeMapper planChangeMapper = mock(TenantPlanChangeMapper.class);
  private final PlatformTenantApplicationService service =
      new PlatformTenantApplicationService(
          tenantMapper, new ObjectMapper(), auditLog, encoder, planChangeMapper);

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  private PlatformTenant tenant(String plan, int limit) {
    return new PlatformTenant("t1", "T", plan, "active", "[]", limit);
  }

  @Test
  void recordsUpgradeWithBeforeAndAfterPlan() {
    TenantContext.set(null, null, "platform-admin");
    when(tenantMapper.findById("t1")).thenReturn(tenant("MVP", 3), tenant("Enterprise", 50));
    when(tenantMapper.updatePlan("t1", "Enterprise", 50)).thenReturn(1);

    service.updateTenantPlan("t1", new UpdateTenantPlanRequest("Enterprise", 50));

    verify(planChangeMapper).insert(
        org.mockito.ArgumentMatchers.startsWith("planchg-"),
        org.mockito.ArgumentMatchers.eq("t1"),
        org.mockito.ArgumentMatchers.eq("MVP"),
        org.mockito.ArgumentMatchers.eq("Enterprise"),
        org.mockito.ArgumentMatchers.eq(3),
        org.mockito.ArgumentMatchers.eq(50),
        org.mockito.ArgumentMatchers.eq("platform-admin"));
  }

  @Test
  void doesNotRecordWhenNothingChanged() {
    TenantContext.set(null, null, "platform-admin");
    when(tenantMapper.findById("t1")).thenReturn(tenant("MVP", 3));
    when(tenantMapper.updatePlan("t1", "MVP", 3)).thenReturn(1);

    service.updateTenantPlan("t1", new UpdateTenantPlanRequest("MVP", 3));

    verify(planChangeMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyInt(),
        org.mockito.ArgumentMatchers.any());
  }

  @Test
  void listPlanChangesLabelsDirection() {
    when(planChangeMapper.listByTenant("t1"))
        .thenReturn(java.util.List.of(
            new com.procurement.platform.domain.TenantPlanChange(
                "pc1", "t1", "Enterprise", "MVP", 50, 3, "admin", java.time.OffsetDateTime.now())));

    var changes = service.listPlanChanges("t1");

    assertThat(changes).hasSize(1);
    assertThat(changes.get(0).direction()).isEqualTo("降级");
  }
}
