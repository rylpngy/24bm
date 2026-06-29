package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditLog;
import com.procurement.audit.infrastructure.AuditLogMapper;
import com.procurement.common.tenant.TenantContext;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class AuditLogQueryTests {

  private final AuditLogMapper auditLogMapper = org.mockito.Mockito.mock(AuditLogMapper.class);
  private final AuditLogApplicationService auditLogApplicationService = new AuditLogApplicationService(auditLogMapper);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listsAuditLogsOnlyForCurrentBuyerTenant() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(auditLogMapper.listByTenant("tenant-1", 50))
        .thenReturn(List.of(new AuditLog(
            "audit-1",
            "tenant-1",
            "buyer-user",
            "purchase_order.created",
            "purchase_order",
            "po-1",
            null,
            OffsetDateTime.parse("2026-06-15T10:00:00+08:00"))));

    var logs = auditLogApplicationService.listCurrentTenantAuditLogs(50);

    assertThat(logs).hasSize(1);
    assertThat(logs.get(0).tenantId()).isEqualTo("tenant-1");
    assertThat(logs.get(0).action()).isEqualTo("purchase_order.created");
  }
}
