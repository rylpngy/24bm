package com.procurement.audit.application;

import com.procurement.audit.infrastructure.AuditLogMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class AuditLogApplicationService {
  private final AuditLogMapper auditLogMapper;

  public AuditLogApplicationService(AuditLogMapper auditLogMapper) {
    this.auditLogMapper = auditLogMapper;
  }

  public void recordTenantAction(String action, String targetType, String targetId) {
    String tenantId = TenantAccessGuard.requireTenantId("audit log APIs");
    recordTenantAction(tenantId, action, targetType, targetId);
  }

  public void recordTenantAction(String tenantId, String action, String targetType, String targetId) {
    String actorId = TenantAccessGuard.requireUserId("audit log APIs");
    auditLogMapper.insert(newId(), tenantId, actorId, action, targetType, targetId);
  }

  private String newId() {
    return "audit-" + UUID.randomUUID();
  }
}
