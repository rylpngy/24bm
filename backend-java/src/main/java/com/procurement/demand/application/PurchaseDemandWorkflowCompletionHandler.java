package com.procurement.demand.application;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.domain.PurchaseDemandAuditAction;
import com.procurement.demand.domain.PurchaseDemandStatus;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.workflow.application.WorkflowBusinessCompletionHandler;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

// Flowable 终态回调。需求状态只在这里更新，避免任务页面或业务接口绕开工作流直接定稿。
@Component
public class PurchaseDemandWorkflowCompletionHandler implements WorkflowBusinessCompletionHandler {
  private final PurchaseDemandMapper purchaseDemandMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public PurchaseDemandWorkflowCompletionHandler(
      PurchaseDemandMapper purchaseDemandMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.purchaseDemandMapper = purchaseDemandMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  @Override
  public String businessType() {
    return ApprovalBusinessType.PURCHASE_DEMAND;
  }

  @Override
  public void onCompleted(WorkflowBusinessInstance instance, WorkflowCompletion completion) {
    PurchaseDemand demand = purchaseDemandMapper.findByTenantAndId(instance.tenantId(), instance.businessId());
    if (demand == null) {
      throw new IllegalStateException("Purchase demand not found for workflow callback: " + instance.businessId());
    }
    if (!PurchaseDemandStatus.IN_APPROVAL.equals(demand.status())) {
      throw new IllegalStateException("Purchase demand is not awaiting workflow approval: " + instance.businessId());
    }
    String nextStatus = completion.approved()
        ? PurchaseDemandStatus.APPROVED
        : PurchaseDemandStatus.REJECTED;
    int updated = purchaseDemandMapper.updateStatus(instance.tenantId(), instance.businessId(), nextStatus);
    if (updated == 0) {
      throw new IllegalStateException("Purchase demand status changed before workflow outcome could be applied: " + instance.businessId());
    }
    auditLogApplicationService.recordTenantAction(
        instance.tenantId(),
        completion.approved() ? PurchaseDemandAuditAction.APPROVED : PurchaseDemandAuditAction.REJECTED,
        ApprovalBusinessType.PURCHASE_DEMAND,
        instance.businessId(),
        completion.comment());
    notificationApplicationService.notifyActiveTenantUsers(
        instance.tenantId(),
        completion.approved()
            ? NotificationTitle.PURCHASE_DEMAND_APPROVED
            : NotificationTitle.PURCHASE_DEMAND_REJECTED,
        "采购需求已审批" + (completion.approved() ? "通过" : "驳回") + "。");
  }
}
