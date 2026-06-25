package com.procurement;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.platform.application.PlatformTenantApplicationService;
import com.procurement.platform.domain.PlatformTenant;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class PlatformTenantStatusChangeTests {

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
  void enableTenantMarksTenantActiveAndRecordsAuditLog() {
    when(platformTenantMapper.updateStatus("tenant-acme", "active")).thenReturn(1);
    when(platformTenantMapper.findById("tenant-acme"))
        .thenReturn(new PlatformTenant(
            "tenant-acme",
            "Acme 采购公司",
            "starter",
            "active",
            "[\"rfq\",\"order\"]",
            50));

    platformTenantApplicationService.enableTenant("tenant-acme");

    verify(platformTenantMapper).updateStatus("tenant-acme", "active");
    verify(auditLogApplicationService).recordTenantAction(
        "tenant-acme",
        "tenant.enabled",
        "tenant",
        "tenant-acme");
  }

  @Test
  void enableTenantRejectsUnknownTenantBeforeWritingAuditLog() {
    when(platformTenantMapper.updateStatus("tenant-missing", "active")).thenReturn(0);

    assertThrows(
        IllegalArgumentException.class,
        () -> platformTenantApplicationService.enableTenant("tenant-missing"));

    verify(auditLogApplicationService, never()).recordTenantAction(
        "tenant-missing",
        "tenant.enabled",
        "tenant",
        "tenant-missing");
  }

  @Test
  void disableTenantMarksTenantInactiveAndRecordsAuditLog() {
    when(platformTenantMapper.updateStatus("tenant-acme", "inactive")).thenReturn(1);
    when(platformTenantMapper.findById("tenant-acme"))
        .thenReturn(new PlatformTenant(
            "tenant-acme",
            "Acme 采购公司",
            "starter",
            "inactive",
            "[\"rfq\",\"order\"]",
            50));

    platformTenantApplicationService.disableTenant("tenant-acme");

    verify(platformTenantMapper).updateStatus("tenant-acme", "inactive");
    verify(auditLogApplicationService).recordTenantAction(
        "tenant-acme",
        "tenant.disabled",
        "tenant",
        "tenant-acme");
  }

  @Test
  void disableTenantRejectsUnknownTenantBeforeWritingAuditLog() {
    when(platformTenantMapper.updateStatus("tenant-missing", "inactive")).thenReturn(0);

    assertThrows(
        IllegalArgumentException.class,
        () -> platformTenantApplicationService.disableTenant("tenant-missing"));

    verify(auditLogApplicationService, never()).recordTenantAction(
        "tenant-missing",
        "tenant.disabled",
        "tenant",
        "tenant-missing");
  }
}
