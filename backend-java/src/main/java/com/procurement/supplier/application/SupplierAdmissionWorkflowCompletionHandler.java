package com.procurement.supplier.application;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.supplier.domain.BuyerSupplierAuditAction;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.domain.BuyerSupplierRelationStatus;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.workflow.application.WorkflowBusinessCompletionHandler;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public class SupplierAdmissionWorkflowCompletionHandler implements WorkflowBusinessCompletionHandler {
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public SupplierAdmissionWorkflowCompletionHandler(
      BuyerSupplierRelationMapper buyerSupplierRelationMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.buyerSupplierRelationMapper = buyerSupplierRelationMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  @Override
  public String businessType() {
    return ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION;
  }

  @Override
  public void onCompleted(WorkflowBusinessInstance instance, WorkflowCompletion completion) {
    BuyerSupplierRelation relation = buyerSupplierRelationMapper.findByTenantAndId(
        instance.tenantId(), instance.businessId());
    if (relation == null) {
      throw new IllegalStateException("Supplier relation not found for workflow callback: " + instance.businessId());
    }
    if (!BuyerSupplierRelationStatus.IN_ADMISSION_APPROVAL.equals(relation.status())) {
      throw new IllegalStateException("Supplier relation is not awaiting workflow approval: " + instance.businessId());
    }
    String nextStatus = completion.approved()
        ? BuyerSupplierRelationStatus.ADMITTED
        : BuyerSupplierRelationStatus.REJECTED;
    int updated = buyerSupplierRelationMapper.updateStatus(
        instance.tenantId(),
        instance.businessId(),
        BuyerSupplierRelationStatus.IN_ADMISSION_APPROVAL,
        nextStatus);
    if (updated == 0) {
      throw new IllegalStateException("Supplier admission status changed before workflow outcome could be applied");
    }
    auditLogApplicationService.recordTenantAction(
        instance.tenantId(),
        completion.approved()
            ? BuyerSupplierAuditAction.ADMISSION_APPROVED
            : BuyerSupplierAuditAction.ADMISSION_REJECTED,
        AuditTargetType.BUYER_SUPPLIER_RELATION,
        instance.businessId(),
        completion.comment());
    notificationApplicationService.notifyActiveTenantUsers(
        instance.tenantId(),
        completion.approved()
            ? NotificationTitle.SUPPLIER_ADMISSION_APPROVED
            : NotificationTitle.SUPPLIER_ADMISSION_REJECTED,
        relation.supplierName() + "准入审批已" + (completion.approved() ? "通过" : "驳回") + "。");
  }
}
