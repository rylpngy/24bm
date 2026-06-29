package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantContext;
import com.procurement.contract.api.CreateContractAmendmentRequest;
import com.procurement.contract.application.ContractApplicationService;
import com.procurement.contract.domain.ContractAmendment;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 合同变更:金额变更应用到主合同 + 审计带「从→到」明细;非法类型/缺新值/已归档拦截。
class ContractAmendmentTests {

  private final ContractMapper contractMapper = mock(ContractMapper.class);
  private final ApprovalTaskMapper approvalTaskMapper = mock(ApprovalTaskMapper.class);
  private final ApprovalTemplateMapper approvalTemplateMapper = mock(ApprovalTemplateMapper.class);
  private final BuyerUserMapper buyerUserMapper = mock(BuyerUserMapper.class);
  private final ApprovalTaskApplicationService approvalTaskApplicationService =
      new ApprovalTaskApplicationService(approvalTaskMapper, approvalTemplateMapper, buyerUserMapper);
  private final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notification = mock(NotificationApplicationService.class);
  private final ContractApplicationService service = new ContractApplicationService(
      contractMapper,
      mock(PurchaseOrderMapper.class),
      approvalTaskMapper,
      approvalTaskApplicationService,
      audit,
      notification);

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  private ContractLedger contract(String archiveStatus) {
    return new ContractLedger(
        "contract-1", "tenant-1", "CTR-1", "测试合同", "po-1", "supplier-1",
        BigDecimal.valueOf(120000), "履约中", archiveStatus, "正常",
        LocalDate.parse("2026-06-21"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"),
        LocalDate.parse("2026-06-01"), LocalDate.parse("2027-06-01"), "电汇", "质保2年");
  }

  private ContractAmendment amendment(BigDecimal oldAmt, BigDecimal newAmt) {
    return new ContractAmendment(
        "contract-amd-x", "tenant-1", "contract-1", 1, ContractAmendment.AMOUNT,
        oldAmt, newAmt, null, null, "新增范围", "buyer-user",
        OffsetDateTime.parse("2026-06-29T10:00:00+08:00"));
  }

  @Test
  void amountChangeAppliesToContractAndAuditsWithDetail() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1")).thenReturn(contract("未归档"));
    when(contractMapper.maxAmendmentSeq("tenant-1", "contract-1")).thenReturn(0);
    when(contractMapper.listAmendments("tenant-1", "contract-1"))
        .thenReturn(List.of(amendment(BigDecimal.valueOf(120000), BigDecimal.valueOf(135000))));

    var resp = service.addCurrentTenantContractAmendment("contract-1",
        new CreateContractAmendmentRequest("金额变更", BigDecimal.valueOf(135000), null, "新增范围"));

    assertThat(resp.seq()).isEqualTo(1);
    verify(contractMapper).insertAmendment(
        any(), eq("tenant-1"), eq("contract-1"), eq(1), eq("金额变更"),
        eq(BigDecimal.valueOf(120000)), eq(BigDecimal.valueOf(135000)),
        org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(),
        eq("新增范围"), eq("buyer-user"));
    verify(contractMapper).updateAmountAndExpiry(
        eq("tenant-1"), eq("contract-1"), eq(BigDecimal.valueOf(135000)), any());
    verify(audit).recordTenantAction(
        eq("tenant-1"), eq("contract_amendment.created"), eq(AuditTargetType.CONTRACT),
        eq("contract-1"), org.mockito.ArgumentMatchers.contains("金额变更"));
  }

  @Test
  void amountChangeWithoutNewAmountIsRejected() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1")).thenReturn(contract("未归档"));

    assertThatThrownBy(() -> service.addCurrentTenantContractAmendment("contract-1",
        new CreateContractAmendmentRequest("金额变更", null, null, "缺新金额")))
        .isInstanceOf(IllegalArgumentException.class);

    verify(contractMapper, never()).updateAmountAndExpiry(any(), any(), any(), any());
  }

  @Test
  void archivedContractCannotBeAmended() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1")).thenReturn(contract("已归档"));

    assertThatThrownBy(() -> service.addCurrentTenantContractAmendment("contract-1",
        new CreateContractAmendmentRequest("金额变更", BigDecimal.valueOf(135000), null, "x")))
        .isInstanceOf(IllegalStateException.class);

    verify(contractMapper, never()).insertAmendment(
        any(), any(), any(), org.mockito.ArgumentMatchers.anyInt(), any(),
        any(), any(), any(), any(), any(), any());
  }

  @Test
  void invalidChangeTypeIsRejected() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1")).thenReturn(contract("未归档"));

    assertThatThrownBy(() -> service.addCurrentTenantContractAmendment("contract-1",
        new CreateContractAmendmentRequest("天气变更", null, null, "x")))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
