package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.contract.api.CreateContractFulfillmentEventRequest;
import com.procurement.contract.application.ContractApplicationService;
import com.procurement.contract.domain.ContractFulfillmentEvent;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.contract.infrastructure.ContractFulfillmentEventMapper;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ContractFulfillmentEventTests {
  private final ContractMapper contractMapper = org.mockito.Mockito.mock(ContractMapper.class);
  private final ContractFulfillmentEventMapper fulfillmentEventMapper =
      org.mockito.Mockito.mock(ContractFulfillmentEventMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final ContractApplicationService contractApplicationService = new ContractApplicationService(
      contractMapper,
      fulfillmentEventMapper,
      purchaseOrderMapper);
  private final ContractApplicationService auditableContractApplicationService = new ContractApplicationService(
      contractMapper,
      fulfillmentEventMapper,
      purchaseOrderMapper,
      null,
      null,
      auditLogApplicationService,
      null);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void creatingContractFulfillmentEventUsesTenantScopeAndPersistsTargetContext() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract());
    when(fulfillmentEventMapper.findByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.startsWith("contract-event-")))
        .thenReturn(event("contract-event-created"));

    var response = contractApplicationService.createCurrentTenantContractFulfillmentEvent(
        "contract-1",
        new CreateContractFulfillmentEventRequest(
            "receipt",
            "po-1",
            "收货验收已由合同联动入口推进：po-1",
            "CTR-1 · 测试采购合同"));

    assertThat(response.contractId()).isEqualTo("contract-1");
    assertThat(response.actionType()).isEqualTo("receipt");
    assertThat(response.targetId()).isEqualTo("po-1");
    verify(fulfillmentEventMapper).insert(
        org.mockito.ArgumentMatchers.startsWith("contract-event-"),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("contract-1"),
        org.mockito.ArgumentMatchers.eq("receipt"),
        org.mockito.ArgumentMatchers.eq("po-1"),
        org.mockito.ArgumentMatchers.eq("收货验收已由合同联动入口推进：po-1"),
        org.mockito.ArgumentMatchers.eq("CTR-1 · 测试采购合同"),
        org.mockito.ArgumentMatchers.eq("buyer-user"));
  }

  @Test
  void listingContractFulfillmentEventsRequiresContractInTenantScope() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract());
    when(fulfillmentEventMapper.listByTenantAndContract("tenant-1", "contract-1"))
        .thenReturn(List.of(event("contract-event-1")));

    var responses = contractApplicationService.listCurrentTenantContractFulfillmentEvents("contract-1");

    assertThat(responses).hasSize(1);
    assertThat(responses.get(0).summary()).contains("合同联动入口推进");
    verify(contractMapper).findByTenantAndId("tenant-1", "contract-1");
    verify(fulfillmentEventMapper).listByTenantAndContract("tenant-1", "contract-1");
  }

  @Test
  void creatingContractFulfillmentEventRecordsAuditLogForArchiveReview() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(contract());
    when(fulfillmentEventMapper.findByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.startsWith("contract-event-")))
        .thenReturn(event("contract-event-created"));

    auditableContractApplicationService.createCurrentTenantContractFulfillmentEvent(
        "contract-1",
        new CreateContractFulfillmentEventRequest(
            "payment",
            "invoice-1",
            "发票付款已由合同联动入口推进：invoice-1",
            "CTR-1 · 测试采购合同"));

    verify(auditLogApplicationService).recordTenantAction(
        "contract_fulfillment_event.created",
        "contract",
        "contract-1");
  }

  @Test
  void creatingContractFulfillmentEventRejectsArchivedContractAsReadOnly() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "contract-1"))
        .thenReturn(archivedContract());

    assertThatThrownBy(() -> auditableContractApplicationService.createCurrentTenantContractFulfillmentEvent(
        "contract-1",
        new CreateContractFulfillmentEventRequest(
            "receipt",
            "po-1",
            "收货验收已由合同联动入口推进：po-1",
            "CTR-1 · 测试采购合同")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Archived contract can only be audited");

    verify(fulfillmentEventMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
    verify(auditLogApplicationService, never()).recordTenantAction(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  private ContractLedger contract() {
    return new ContractLedger(
        "contract-1",
        "tenant-1",
        "CTR-1",
        "测试采购合同",
        "po-1",
        "supplier-1",
        BigDecimal.valueOf(60000),
        "已生效",
        "未归档",
        "履约中",
        LocalDate.parse("2026-06-21"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"), java.time.LocalDate.parse("2026-06-01"), java.time.LocalDate.parse("2027-06-01"), "验收后30天内电汇", "质保2年，逾期交付按日0.5%计违约金");
  }

  private ContractLedger archivedContract() {
    return new ContractLedger(
        "contract-1",
        "tenant-1",
        "CTR-1",
        "测试采购合同",
        "po-1",
        "supplier-1",
        BigDecimal.valueOf(60000),
        "履约完成",
        "已归档",
        "履约完成",
        LocalDate.parse("2026-06-21"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"),
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"), java.time.LocalDate.parse("2026-06-01"), java.time.LocalDate.parse("2027-06-01"), "验收后30天内电汇", "质保2年，逾期交付按日0.5%计违约金");
  }

  private ContractFulfillmentEvent event(String id) {
    return new ContractFulfillmentEvent(
        id,
        "tenant-1",
        "contract-1",
        "receipt",
        "po-1",
        "收货验收已由合同联动入口推进：po-1",
        "CTR-1 · 测试采购合同",
        "buyer-user",
        OffsetDateTime.parse("2026-06-21T08:00:00+08:00"));
  }
}
