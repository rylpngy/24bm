package com.procurement;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.platform.api.UpdateTenantPlanRequest;
import com.procurement.platform.application.PlatformTenantApplicationService;
import com.procurement.platform.domain.PlatformTenant;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class PlatformTenantPlanUpdateTests {

  private final PlatformTenantMapper platformTenantMapper =
      org.mockito.Mockito.mock(PlatformTenantMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final PasswordEncoder passwordEncoder = org.mockito.Mockito.mock(PasswordEncoder.class);
  private final PlatformTenantApplicationService platformTenantApplicationService =
      new PlatformTenantApplicationService(
          platformTenantMapper,
          new ObjectMapper(),
          auditLogApplicationService,
          passwordEncoder,
        org.mockito.Mockito.mock(com.procurement.platform.infrastructure.TenantPlanChangeMapper.class));

  @Test
  void updateTenantPlanChangesPlanAndUserLimitAndRecordsAuditLog() {
    when(platformTenantMapper.updatePlan("tenant-acme", "pro", 120)).thenReturn(1);
    when(platformTenantMapper.findById("tenant-acme"))
        .thenReturn(new PlatformTenant(
            "tenant-acme",
            "Acme 采购公司",
            "pro",
            "active",
            "[\"rfq\",\"order\"]",
            120));

    platformTenantApplicationService.updateTenantPlan(
        "tenant-acme",
        new UpdateTenantPlanRequest("pro", 120));

    verify(platformTenantMapper).updatePlan("tenant-acme", "pro", 120);
    verify(auditLogApplicationService).recordTenantAction(
        "tenant-acme",
        "tenant.plan_updated",
        "tenant",
        "tenant-acme");
  }

  @Test
  void updateTenantPlanRejectsUnknownTenantBeforeWritingAuditLog() {
    when(platformTenantMapper.updatePlan("tenant-missing", "pro", 120)).thenReturn(0);

    assertThrows(
        IllegalArgumentException.class,
        () -> platformTenantApplicationService.updateTenantPlan(
            "tenant-missing",
            new UpdateTenantPlanRequest("pro", 120)));

    verify(auditLogApplicationService, never()).recordTenantAction(
        "tenant-missing",
        "tenant.plan_updated",
        "tenant",
        "tenant-missing");
  }
}
