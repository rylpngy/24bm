package com.procurement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.platform.api.TenantResponse;
import com.procurement.platform.application.PlatformTenantApplicationService;
import com.procurement.platform.domain.PlatformTenant;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class PlatformTenantDetailTests {

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
          passwordEncoder);

  @Test
  void getTenantReturnsTenantDetailWithParsedFeatureFlags() {
    when(platformTenantMapper.findById("tenant-acme"))
        .thenReturn(new PlatformTenant(
            "tenant-acme",
            "Acme 采购公司",
            "pro",
            "active",
            "[\"rfq\",\"order\",\"finance\"]",
            120));

    TenantResponse response = platformTenantApplicationService.getTenant("tenant-acme");

    assertEquals("tenant-acme", response.id());
    assertEquals("pro", response.plan());
    assertEquals("active", response.status());
    assertEquals(120, response.userLimit());
    assertEquals(List.of("rfq", "order", "finance"), response.enabledFeatures());
  }

  @Test
  void getTenantRejectsUnknownTenant() {
    when(platformTenantMapper.findById("tenant-missing")).thenReturn(null);

    assertThrows(
        IllegalArgumentException.class,
        () -> platformTenantApplicationService.getTenant("tenant-missing"));
  }
}
