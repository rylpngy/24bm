package com.procurement.audit.application;

import com.procurement.audit.api.AuditLogResponse;
import com.procurement.audit.domain.AuditLog;
import com.procurement.audit.infrastructure.AuditLogMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import java.util.List;
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

  public List<AuditLogResponse> listCurrentTenantAuditLogs(int limit) {
    String tenantId = TenantAccessGuard.requireTenantId("audit log APIs");
    int safeLimit = Math.max(1, Math.min(limit, 200));
    return auditLogMapper.listByTenant(tenantId, safeLimit).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<AuditLogResponse> listCurrentTenantTargetActions(
      String targetType,
      String targetId,
      List<String> actions,
      int limit) {
    String tenantId = TenantAccessGuard.requireTenantId("audit log APIs");
    int safeLimit = Math.max(1, Math.min(limit, 200));
    return auditLogMapper.listByTenantTargetActions(tenantId, targetType, targetId, actions, safeLimit).stream()
        .map(this::toResponse)
        .toList();
  }

  private AuditLogResponse toResponse(AuditLog auditLog) {
    return new AuditLogResponse(
        auditLog.id(),
        auditLog.tenantId(),
        auditLog.actorId(),
        auditLog.action(),
        auditLog.targetType(),
        auditLog.targetId(),
        auditLog.createdAt());
  }

  private String newId() {
    return "audit-" + UUID.randomUUID();
  }
}
