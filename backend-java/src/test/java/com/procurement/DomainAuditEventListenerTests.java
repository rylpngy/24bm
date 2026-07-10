package com.procurement;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.application.DomainAuditEventListener;
import com.procurement.common.event.DomainAuditEvent;
import org.junit.jupiter.api.Test;

// 领域审计事件监听器:把 DomainAuditEvent 转成审计落库调用(同步,沿用 TenantContext)。
class DomainAuditEventListenerTests {

  @Test
  void forwardsDomainAuditEventToAuditService() {
    AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
    DomainAuditEventListener listener = new DomainAuditEventListener(audit);

    listener.onDomainAudit(new DomainAuditEvent("material.created", "material", "mat-1"));

    verify(audit).recordCurrentTenantAction("material.created", "material", "mat-1", null);
  }

  @Test
  void forwardsDetailWhenPresent() {
    AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
    DomainAuditEventListener listener = new DomainAuditEventListener(audit);

    listener.onDomainAudit(
        new DomainAuditEvent("buyer_role.permissions_updated", "buyer_role", "role-fin", "+导出报表"));

    verify(audit).recordCurrentTenantAction(
        "buyer_role.permissions_updated", "buyer_role", "role-fin", "+导出报表");
  }
}
