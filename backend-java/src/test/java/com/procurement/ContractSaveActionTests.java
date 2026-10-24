package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.contract.api.CreateContractRequest;
import com.procurement.contract.api.UpdateContractRequest;
import com.procurement.contract.application.ContractApplicationService;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ContractSaveActionTests {
  private final ContractMapper contractMapper = org.mockito.Mockito.mock(ContractMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final ContractApplicationService contractApplicationService = new ContractApplicationService(
      contractMapper,
      purchaseOrderMapper);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @org.junit.jupiter.api.BeforeEach
  void configureAccess() { TestContractAccess.allow(contractApplicationService); }

  @Test
  void ordinaryCreationCannotClaimEffectiveApproval() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1")).thenReturn(order());
    when(contractMapper.findByTenantAndId(org.mockito.ArgumentMatchers.eq("tenant-1"), org.mockito.ArgumentMatchers.anyString()))
        .thenReturn(contract("contract-created", "未归档"));
    assertThatThrownBy(() -> contractApplicationService.createCurrentTenantContract(new CreateContractRequest(
        "CTR-1", "合同", "po-1", BigDecimal.valueOf(60000), "已生效", "履约中",
        null, null, null, null, null))).isInstanceOf(IllegalStateException.class);
  }

  @Test
  void ordinaryUpdateCannotChangeEffectiveContractOrForgeDraft() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract("contract-1", "未归档"));
    assertThatThrownBy(() -> contractApplicationService.updateCurrentTenantContract("contract-1",
        new UpdateContractRequest("CTR-1", "合同", BigDecimal.TEN, "草案", "草案",
            null, null, null, null, null))).isInstanceOf(IllegalStateException.class);
  }

  @Test
  void creatingContractUsesTenantOrderAndReturnsSavedLedger() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order());
    when(contractMapper.findByTenantAndId(org.mockito.ArgumentMatchers.eq("tenant-1"), org.mockito.ArgumentMatchers.startsWith("contract-")))
        .thenReturn(contract("contract-created", "未归档"));

    var response = contractApplicationService.createCurrentTenantContract(new CreateContractRequest(
        "CTR-NEW-1",
        "新建采购合同",
        "po-1",
        BigDecimal.valueOf(60000),
        "草案",
        "履约中",
        LocalDate.parse("2026-06-21"), null, null, null, null));

    assertThat(response.contractNo()).isEqualTo("CTR-NEW-1");
    assertThat(response.relatedOrderId()).isEqualTo("po-1");
    verify(contractMapper).insert(
        org.mockito.ArgumentMatchers.startsWith("contract-"),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("CTR-NEW-1"),
        org.mockito.ArgumentMatchers.eq("新建采购合同"),
        org.mockito.ArgumentMatchers.eq("po-1"),
        org.mockito.ArgumentMatchers.eq("supplier-1"),
        org.mockito.ArgumentMatchers.eq(BigDecimal.valueOf(60000)),
        org.mockito.ArgumentMatchers.eq("草案"),
        org.mockito.ArgumentMatchers.eq("未归档"),
        org.mockito.ArgumentMatchers.eq("履约中"),
        org.mockito.ArgumentMatchers.eq(LocalDate.parse("2026-06-21")),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.eq(""),
        org.mockito.ArgumentMatchers.eq(""));
  }

  @Test
  void creatingContractRejectsOrderOutsideTenantScope() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-other"))
        .thenReturn(null);

    assertThatThrownBy(() -> contractApplicationService.createCurrentTenantContract(new CreateContractRequest(
        "CTR-NEW-2",
        "跨租户采购合同",
        "po-other",
        BigDecimal.valueOf(60000),
        "草案",
        "履约中",
        LocalDate.parse("2026-06-21"), null, null, null, null)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Purchase order not found in tenant scope");

    verify(contractMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void updatingContractMetadataKeepsArchivedContractsReadOnly() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract("contract-1", "已归档"));

    assertThatThrownBy(() -> contractApplicationService.updateCurrentTenantContract(
        "contract-1",
        new UpdateContractRequest(
            "CTR-EDIT-1",
            "编辑采购合同",
            BigDecimal.valueOf(61000),
            "履约完成",
            "已收货验收",
            LocalDate.parse("2026-06-22"), null, null, null, null)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Archived contract can only be audited");

    verify(contractMapper, never()).updateDetails(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  private PurchaseOrder order() {
    return new PurchaseOrder(
        "po-1",
        "tenant-1",
        "rfq-1",
        "supplier-1",
        BigDecimal.valueOf(60000),
        "已收货",
        LocalDate.parse("2026-06-21"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"), "上海市浦东新区张江路100号", "王收货", "021-58880000", "货到验收30天内付款");
  }

  private ContractLedger contract(String id, String archiveStatus) {
    return new ContractLedger(
        id,
        "tenant-1",
        "CTR-NEW-1",
        "新建采购合同",
        "po-1",
        "supplier-1",
        BigDecimal.valueOf(60000),
        "已生效",
        archiveStatus,
        "履约中",
        LocalDate.parse("2026-06-21"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"), java.time.LocalDate.parse("2026-06-01"), java.time.LocalDate.now().plusMonths(11), "验收后30天内电汇", "质保2年，逾期交付按日0.5%计违约金", null);
  }
}
