package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.contract.application.ContractApplicationService;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ContractExpiryScanTests {
  private final ContractMapper contractMapper = org.mockito.Mockito.mock(ContractMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final ContractApplicationService contractApplicationService = new ContractApplicationService(
      contractMapper,
      purchaseOrderMapper,
      null,
      null,
      auditLogApplicationService,
      notificationApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void scanExpiringContractsUsesTenantScopeAndNotifiesActiveUsers() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.listExpiringWithin(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.any(LocalDate.class)))
        .thenReturn(List.of(contract("contract-1", "测试采购合同", LocalDate.now().plusDays(4))));

    var response = contractApplicationService.scanExpiringContracts(30);

    assertThat(response.withinDays()).isEqualTo(30);
    assertThat(response.scanned()).isEqualTo(1);
    assertThat(response.notified()).isEqualTo(1);
    verify(contractMapper).listExpiringWithin(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.any(LocalDate.class));
    verify(notificationApplicationService).notifyActiveTenantUsers(
        "tenant-1",
        "合同到期提醒",
        "合同「测试采购合同」将于 " + LocalDate.now().plusDays(4) + " 到期,请及时安排续签或归档。");
    verify(auditLogApplicationService).recordTenantAction(
        "tenant-1",
        "contract.expiry_scanned",
        "contract",
        "batch",
        "扫描到 1 份临近到期合同并生成提醒");
  }

  @Test
  void scanExpiringContractsDefaultsNonPositiveWindowToSixtyDays() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.listExpiringWithin(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.any(LocalDate.class)))
        .thenReturn(List.of());

    var response = contractApplicationService.scanExpiringContracts(0);

    assertThat(response.withinDays()).isEqualTo(60);
    assertThat(response.scanned()).isZero();
    assertThat(response.notified()).isZero();
  }

  private ContractLedger contract(String id, String name, LocalDate expiryDate) {
    return new ContractLedger(
        id,
        "tenant-1",
        "CTR-1",
        name,
        "po-1",
        "supplier-1",
        BigDecimal.valueOf(60000),
        "已生效",
        "未归档",
        "履约中",
        LocalDate.parse("2026-06-21"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"),
        LocalDate.parse("2026-06-01"),
        expiryDate,
        "验收后30天内电汇",
        "质保2年，逾期交付按日0.5%计违约金",
        null);
  }
}
