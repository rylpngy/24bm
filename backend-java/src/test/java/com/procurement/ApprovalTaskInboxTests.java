package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.api.PendingApprovalTaskResponse;
import com.procurement.approval.application.ApprovalInboxApplicationService;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ApprovalTaskInboxTests {

  private final ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
  private final PurchaseDemandMapper purchaseDemandMapper = org.mockito.Mockito.mock(PurchaseDemandMapper.class);
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper =
      org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
  private final AwardDecisionMapper awardDecisionMapper = org.mockito.Mockito.mock(AwardDecisionMapper.class);
  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final ApprovalInboxApplicationService approvalInboxApplicationService =
      new ApprovalInboxApplicationService(
          approvalTaskMapper,
          purchaseDemandMapper,
          buyerSupplierRelationMapper,
          awardDecisionMapper,
          rfqMapper);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listsPendingApprovalTasksForCurrentTenantOnly() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(approvalTaskMapper.listByTenantAndStatus("tenant-1", "待审批"))
        .thenReturn(List.of(
            task("approval-2", "tenant-1", "rfq_award", "award-1", "待审批", "2026-06-15T12:00:00+08:00"),
            task("approval-1", "tenant-1", "purchase_demand", "demand-1", "待审批", "2026-06-15T10:00:00+08:00")));
    when(awardDecisionMapper.findByTenantAndId("tenant-1", "award-1"))
        .thenReturn(awardDecision("award-1", "tenant-1", "rfq-1", "supplier-1"));
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "办公电脑询价"));
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "demand-1"))
        .thenReturn(demand("demand-1", "tenant-1", "采购 20 台电脑", BigDecimal.valueOf(120000)));

    List<PendingApprovalTaskResponse> responses = approvalInboxApplicationService.listPending();

    assertThat(responses).extracting(PendingApprovalTaskResponse::id)
        .containsExactly("approval-2", "approval-1");
    assertThat(responses).extracting(PendingApprovalTaskResponse::bizType)
        .containsExactly("rfq_award", "purchase_demand");
    assertThat(responses).extracting(PendingApprovalTaskResponse::summaryTitle)
        .containsExactly("办公电脑询价", "采购 20 台电脑");
    assertThat(responses).extracting(PendingApprovalTaskResponse::parentBizId)
        .containsExactly("rfq-1", null);
    assertThat(responses).extracting(PendingApprovalTaskResponse::amount)
        .containsExactly(BigDecimal.valueOf(98000), BigDecimal.valueOf(120000));
    verify(approvalTaskMapper).listByTenantAndStatus("tenant-1", "待审批");
  }

  @Test
  void enrichesSupplierAdmissionPendingTasksWithSupplierSummary() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(approvalTaskMapper.listByTenantAndStatus("tenant-1", "待审批"))
        .thenReturn(List.of(
            task("approval-1", "tenant-1", "buyer_supplier_admission", "rel-1", "待审批", "2026-06-15T10:00:00+08:00")));
    when(buyerSupplierRelationMapper.findByTenantAndId("tenant-1", "rel-1"))
        .thenReturn(supplierRelation("rel-1", "tenant-1", "晨光供应商"));

    List<PendingApprovalTaskResponse> responses = approvalInboxApplicationService.listPending();

    assertThat(responses).singleElement()
        .satisfies(response -> {
          assertThat(response.summaryTitle()).isEqualTo("晨光供应商");
          assertThat(response.counterpartyName()).isEqualTo("晨光供应商");
          assertThat(response.amount()).isNull();
        });
  }

  private ApprovalTask task(
      String id,
      String tenantId,
      String bizType,
      String bizId,
      String status,
      String createdAt) {
    return new ApprovalTask(
        id,
        tenantId,
        bizType,
        bizId,
        null,
        status,
        OffsetDateTime.parse(createdAt));
  }

  private PurchaseDemand demand(String id, String tenantId, String title, BigDecimal budget) {
    return new PurchaseDemand(
        id,
        tenantId,
        title,
        "dept-1",
        "requester-1",
        budget,
        "审批中",
        OffsetDateTime.parse("2026-06-15T09:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T09:00:00+08:00"));
  }

  private BuyerSupplierRelation supplierRelation(String id, String tenantId, String supplierName) {
    return new BuyerSupplierRelation(
        id,
        tenantId,
        "supplier-1",
        supplierName,
        "准入审批中",
        "A",
        "[]",
        BigDecimal.ZERO);
  }

  private AwardDecision awardDecision(String id, String tenantId, String rfqId, String supplierId) {
    return new AwardDecision(
        id,
        tenantId,
        rfqId,
        "quote-1",
        supplierId,
        BigDecimal.valueOf(98000),
        "最低价",
        "待审批",
        OffsetDateTime.parse("2026-06-15T11:30:00+08:00"));
  }

  private Rfq rfq(String id, String tenantId, String title) {
    return new Rfq(
        id,
        tenantId,
        title,
        "定标审批中",
        OffsetDateTime.parse("2026-06-20T18:00:00+08:00"),
        "owner-1",
        null,
        OffsetDateTime.parse("2026-06-15T09:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T09:00:00+08:00"));
  }
}
