package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.contract.application.ContractWorkflowCompletionHandler;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import com.procurement.workflow.domain.WorkflowInstanceStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

class ContractWorkflowCompletionHandlerTests {

  private final ContractMapper contractMapper = org.mockito.Mockito.mock(ContractMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final ContractWorkflowCompletionHandler handler = new ContractWorkflowCompletionHandler(
      contractMapper, auditLogApplicationService, notificationApplicationService);

  @Test
  void approvalActivatesContractAndRecordsTheActualReviewer() {
    ContractLedger contract = contract("审批中", "审批中");
    when(contractMapper.findByTenantAndId("tenant-1", contract.id())).thenReturn(contract);
    when(contractMapper.updateStatus("tenant-1", contract.id(), "审批中", "已生效", "已生效"))
        .thenReturn(1);

    handler.onCompleted(workflowInstance(), new WorkflowCompletion(
        true, "reviewer-1", "合同条款和金额已核验"));

    verify(auditLogApplicationService).recordTenantAction(
        "tenant-1",
        "contract_approval.approved",
        ApprovalBusinessType.CONTRACT_APPROVAL,
        contract.id(),
        "合同条款和金额已核验");
    verify(notificationApplicationService).notifyActiveTenantUsers(
        "tenant-1",
        NotificationTitle.CONTRACT_APPROVAL_APPROVED,
        "办公电脑采购合同审批已通过。");
  }

  @Test
  void rejectionReturnsContractToDraftForRevision() {
    ContractLedger contract = contract("审批中", "审批中");
    when(contractMapper.findByTenantAndId("tenant-1", contract.id())).thenReturn(contract);
    when(contractMapper.updateStatus("tenant-1", contract.id(), "审批中", "草案", "待审批"))
        .thenReturn(1);

    handler.onCompleted(workflowInstance(), new WorkflowCompletion(
        false, "reviewer-1", "违约责任条款需补充"));

    verify(auditLogApplicationService).recordTenantAction(
        "tenant-1",
        "contract_approval.rejected",
        ApprovalBusinessType.CONTRACT_APPROVAL,
        contract.id(),
        "违约责任条款需补充");
    verify(notificationApplicationService).notifyActiveTenantUsers(
        "tenant-1",
        NotificationTitle.CONTRACT_APPROVAL_REJECTED,
        "办公电脑采购合同审批已驳回。");
  }

  private WorkflowBusinessInstance workflowInstance() {
    OffsetDateTime now = OffsetDateTime.parse("2026-08-26T10:00:00+08:00");
    return new WorkflowBusinessInstance(
        "workflow-1",
        "tenant-1",
        ApprovalBusinessType.CONTRACT_APPROVAL,
        "contract-1",
        "workflow-def-v1",
        "flowable-1",
        WorkflowInstanceStatus.PROCESSING,
        "requester-1",
        "dept-1",
        new BigDecimal("118000"),
        "{}",
        "{}",
        null,
        null,
        now,
        now);
  }

  private ContractLedger contract(String status, String fulfillmentProgress) {
    OffsetDateTime now = OffsetDateTime.parse("2026-08-26T10:00:00+08:00");
    LocalDate contractStartDate = LocalDate.now().plusDays(5);
    return new ContractLedger(
        "contract-1",
        "tenant-1",
        "CTR-1",
        "办公电脑采购合同",
        "po-1",
        "supplier-1",
        new BigDecimal("118000"),
        status,
        "未归档",
        fulfillmentProgress,
        contractStartDate,
        now,
        now,
        LocalDate.parse("2026-08-26"),
        contractStartDate.plusYears(1).minusDays(1),
        "验收后30日内付款",
        "原厂三年质保",
        null);
  }
}
