package com.procurement.contract.application;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.workflow.application.WorkflowBusinessCompletionHandler;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public class ContractWorkflowCompletionHandler implements WorkflowBusinessCompletionHandler {
  private final ContractMapper contractMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public ContractWorkflowCompletionHandler(
      ContractMapper contractMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.contractMapper = contractMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  @Override
  public String businessType() {
    return ApprovalBusinessType.CONTRACT_APPROVAL;
  }

  @Override
  public void onCompleted(WorkflowBusinessInstance instance, WorkflowCompletion completion) {
    ContractLedger contract = contractMapper.findByTenantAndId(instance.tenantId(), instance.businessId());
    if (contract == null || !"审批中".equals(contract.status())) {
      throw new IllegalStateException("Contract is not awaiting workflow approval: " + instance.businessId());
    }
    String targetStatus = completion.approved() ? "已生效" : "草案";
    String targetProgress = completion.approved() ? "已生效" : "待审批";
    if (contractMapper.updateStatus(
        instance.tenantId(), instance.businessId(), "审批中", targetStatus, targetProgress) == 0) {
      throw new IllegalStateException("Contract changed before workflow outcome could be applied: " + instance.businessId());
    }
    auditLogApplicationService.recordTenantAction(
        instance.tenantId(),
        completion.approved() ? "contract_approval.approved" : "contract_approval.rejected",
        ApprovalBusinessType.CONTRACT_APPROVAL,
        instance.businessId(),
        completion.comment());
    notificationApplicationService.notifyActiveTenantUsers(
        instance.tenantId(),
        completion.approved()
            ? NotificationTitle.CONTRACT_APPROVAL_APPROVED
            : NotificationTitle.CONTRACT_APPROVAL_REJECTED,
        contract.contractName() + "审批已" + (completion.approved() ? "通过" : "驳回") + "。");
  }
}
