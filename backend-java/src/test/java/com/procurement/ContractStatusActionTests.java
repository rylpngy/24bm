package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.contract.api.UpdateContractArchiveStatusRequest;
import com.procurement.contract.api.UpdateContractStatusRequest;
import com.procurement.contract.application.ContractApplicationService;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ContractStatusActionTests {
  private final ContractMapper contractMapper = org.mockito.Mockito.mock(ContractMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final ContractApplicationService contractApplicationService = new ContractApplicationService(
      contractMapper,
      purchaseOrderMapper);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void updatingContractStatusUsesTenantScopeAndReturnsRefreshedContract() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract("履约中", "未归档"));
    when(contractMapper.updateStatus(
        "tenant-1",
        "contract-1",
        "履约中",
        "已生效",
        "收货验收中"))
        .thenReturn(1);
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract("履约中", "未归档"), contract("已生效", "未归档"));

    var response = contractApplicationService.updateCurrentTenantContractStatus(
        "contract-1",
        new UpdateContractStatusRequest("已生效", "收货验收中"));

    assertThat(response.id()).isEqualTo("contract-1");
    assertThat(response.status()).isEqualTo("已生效");
    verify(contractMapper).updateStatus(
        "tenant-1",
        "contract-1",
        "履约中",
        "已生效",
        "收货验收中");
  }

  @Test
  void archivingContractWritesArchiveStatusAndFreezesTheContract() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract("已生效", "未归档"));
    when(contractMapper.countArchiveBlockers("tenant-1", "contract-1"))
        .thenReturn(0);
    when(contractMapper.updateArchiveStatus(
        "tenant-1",
        "contract-1",
        "未归档",
        "已归档"))
        .thenReturn(1);
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract("已生效", "未归档"), contract("已生效", "已归档"));

    var response = contractApplicationService.updateCurrentTenantContractArchiveStatus(
        "contract-1",
        new UpdateContractArchiveStatusRequest("已归档"));

    assertThat(response.archiveStatus()).isEqualTo("已归档");
    verify(contractMapper).updateArchiveStatus(
        "tenant-1",
        "contract-1",
        "未归档",
        "已归档");
  }

  @Test
  void archivingContractRequiresReceivedOrderAndPaidInvoice() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract("已生效", "未归档"));
    when(contractMapper.countArchiveBlockers("tenant-1", "contract-1"))
        .thenReturn(2);

    assertThatThrownBy(() -> contractApplicationService.updateCurrentTenantContractArchiveStatus(
        "contract-1",
        new UpdateContractArchiveStatusRequest("已归档")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Contract archive conditions are not satisfied")
        .hasMessageContaining("receipt and payment must be completed");

    verify(contractMapper, never()).updateArchiveStatus(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void archivedContractCannotBeChangedByStatusAction() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract("已生效", "已归档"));

    assertThatThrownBy(() -> contractApplicationService.updateCurrentTenantContractStatus(
        "contract-1",
        new UpdateContractStatusRequest("履约完成", "已收货验收")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Archived contract can only be audited");

    verify(contractMapper, never()).updateStatus(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  private ContractLedger contract(String status, String archiveStatus) {
    return new ContractLedger(
        "contract-1",
        "tenant-1",
        "CTR-1",
        "测试采购合同",
        "po-1",
        "supplier-1",
        BigDecimal.valueOf(60000),
        status,
        archiveStatus,
        "履约中",
        LocalDate.parse("2026-06-21"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"), java.time.LocalDate.parse("2026-06-01"), java.time.LocalDate.parse("2027-06-01"), "验收后30天内电汇", "质保2年，逾期交付按日0.5%计违约金", null);
  }
}
