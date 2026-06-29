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
    recordTenantAction(tenantId, action, targetType, targetId, null);
  }

  // 当前租户上下文 + 明细:detail 记录「改了什么」(如 角色: 财务专员 → 采购管理员)。
  // 独立命名以避免与 (tenantId, action, type, id) 的四参重载擦除冲突。
  public void recordCurrentTenantAction(
      String action, String targetType, String targetId, String detail) {
    String tenantId = TenantAccessGuard.requireTenantId("audit log APIs");
    recordTenantAction(tenantId, action, targetType, targetId, detail);
  }

  public void recordTenantAction(String tenantId, String action, String targetType, String targetId) {
    recordTenantAction(tenantId, action, targetType, targetId, null);
  }

  public void recordTenantAction(
      String tenantId, String action, String targetType, String targetId, String detail) {
    String actorId = TenantAccessGuard.requireUserId("audit log APIs");
    auditLogMapper.insert(newId(), tenantId, actorId, action, targetType, targetId, detail);
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
    return listTenantTargetActions(tenantId, targetType, targetId, actions, limit);
  }

  public List<AuditLogResponse> listTenantTargetActions(
      String tenantId,
      String targetType,
      String targetId,
      List<String> actions,
      int limit) {
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
        auditLog.detail(),
        auditLog.createdAt());
  }

  private String newId() {
    return "audit-" + UUID.randomUUID();
  }
}
