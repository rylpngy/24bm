package com.procurement.audit.application;

import com.procurement.common.event.DomainAuditEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

// 领域审计事件监听器:把跨模块发布的 DomainAuditEvent 落成审计日志。
// 默认同步监听 → 与发布方同线程/同事务,TenantContext 仍有效。
@Component
public class DomainAuditEventListener {
  private final AuditLogApplicationService auditLogApplicationService;

  public DomainAuditEventListener(AuditLogApplicationService auditLogApplicationService) {
    this.auditLogApplicationService = auditLogApplicationService;
  }

  @EventListener
  public void onDomainAudit(DomainAuditEvent event) {
    auditLogApplicationService.recordCurrentTenantAction(
        event.action(), event.targetType(), event.targetId(), event.detail());
  }
}
