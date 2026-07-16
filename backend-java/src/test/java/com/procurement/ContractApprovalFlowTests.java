package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.domain.ApprovalTemplate;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.contract.api.ReviewContractApprovalRequest;
import com.procurement.contract.application.ContractApplicationService;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ContractApprovalFlowTests {
  private final ContractMapper contractMapper = org.mockito.Mockito.mock(ContractMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
  private final ApprovalTemplateMapper approvalTemplateMapper = org.mockito.Mockito.mock(ApprovalTemplateMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final ApprovalTaskApplicationService approvalTaskApplicationService =
      new ApprovalTaskApplicationService(approvalTaskMapper, approvalTemplateMapper, buyerUserMapper);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final ContractApplicationService contractApplicationService = new ContractApplicationService(
      contractMapper,
      purchaseOrderMapper,
      approvalTaskMapper,
      approvalTaskApplicationService,
      auditLogApplicationService,
      notificationApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void submittingContractApprovalCreatesApprovalTaskAndMovesContractToApproval() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract("草案", "待审批"));
    when(contractMapper.updateStatus("tenant-1", "contract-1", "草案", "审批中", "审批中"))
        .thenReturn(1);
    when(approvalTemplateMapper.findActiveByTenantAndBizType("tenant-1", "contract_approval"))
        .thenReturn(template());
    when(buyerUserMapper.findDefaultApproverId("tenant-1", "role-buyer-owner"))
        .thenReturn("approver-1");
    when(approvalTaskMapper.findByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> task(invocation.getArgument(1), "待审批"));
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract("草案", "待审批"), contract("审批中", "审批中"));

    var response = contractApplicationService.submitCurrentTenantContractApproval("contract-1");

    assertThat(response.status()).isEqualTo("审批中");
    verify(approvalTaskMapper).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("contract_approval"),
        org.mockito.ArgumentMatchers.eq("contract-1"),
        org.mockito.ArgumentMatchers.eq("approver-1"),
        org.mockito.ArgumentMatchers.eq("待审批"));
    verify(auditLogApplicationService).recordTenantAction(
        "contract_approval.submitted",
        "contract_approval",
        "contract-1");
    verify(notificationApplicationService).notifyActiveTenantUsers(
        "tenant-1",
        "合同审批待处理",
        "测试采购合同已提交合同审批，请及时处理。");
  }

  @Test
  void approvingContractApprovalCompletesTaskAndActivatesContract() {
    TenantContext.set("tenant-1", null, "approver-1");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract("审批中", "审批中"));
    when(approvalTaskMapper.findPendingByBiz("tenant-1", "contract_approval", "contract-1", "待审批"))
        .thenReturn(task("approval-1", "待审批"));
    when(approvalTaskMapper.updateStatus("tenant-1", "approval-1", "待审批", "已通过", "approver-1", null))
        .thenReturn(1);
    when(contractMapper.updateStatus("tenant-1", "contract-1", "审批中", "已生效", "已生效"))
        .thenReturn(1);
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract("审批中", "审批中"), contract("已生效", "已生效"));

    var response = contractApplicationService.reviewCurrentTenantContractApproval(
        "contract-1",
        new ReviewContractApprovalRequest(true));

    assertThat(response.status()).isEqualTo("已生效");
    verify(auditLogApplicationService).recordTenantAction(
        "contract_approval.approved",
        "contract_approval",
        "contract-1");
    verify(notificationApplicationService).notifyActiveTenantUsers(
        "tenant-1",
        "合同审批已通过",
        "测试采购合同审批已通过。");
  }

  private ApprovalTemplate template() {
    return new ApprovalTemplate(
        "TPL_CONTRACT_APPROVAL",
        "tenant-1",
        "contract_approval",
        "合同审批",
        "role-buyer-owner",
        "active");
  }

  private ApprovalTask task(String id, String status) {
    return new ApprovalTask(
        id,
        "tenant-1",
        "contract_approval",
        "contract-1",
        "approver-1",
        status,
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"),
        null);
  }

  private ContractLedger contract(String status, String fulfillmentProgress) {
    return new ContractLedger(
        "contract-1",
        "tenant-1",
        "CTR-1",
        "测试采购合同",
        "po-1",
        "supplier-1",
        BigDecimal.valueOf(60000),
        status,
        "未归档",
        fulfillmentProgress,
        LocalDate.parse("2026-06-21"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"), java.time.LocalDate.parse("2026-06-01"), java.time.LocalDate.now().plusMonths(11), "验收后30天内电汇", "质保2年，逾期交付按日0.5%计违约金", null);
  }
}
