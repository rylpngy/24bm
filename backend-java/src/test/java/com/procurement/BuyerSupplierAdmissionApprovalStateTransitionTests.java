package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.api.ApprovalTaskResponse;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.supplier.api.ReviewBuyerSupplierAdmissionRequest;
import com.procurement.supplier.application.BuyerSupplierApplicationService;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class BuyerSupplierAdmissionApprovalStateTransitionTests {

  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper =
      org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
  private final ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final ApprovalTaskApplicationService approvalTaskApplicationService =
      new ApprovalTaskApplicationService(approvalTaskMapper, buyerUserMapper);
  private final AuditLogApplicationService auditLogApplicationService = org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final BuyerSupplierApplicationService buyerSupplierApplicationService =
      new BuyerSupplierApplicationService(
          buyerSupplierRelationMapper,
          new ObjectMapper(),
          approvalTaskMapper,
          approvalTaskApplicationService,
          auditLogApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void submitCreatesPendingAdmissionApprovalForPendingSupplierRelation() {
    TenantContext.set("tenant-1", null, "buyer-1");
    when(buyerSupplierRelationMapper.findByTenantAndId("tenant-1", "rel-1"))
        .thenReturn(relation("rel-1", "tenant-1", "待准入"));
    when(buyerSupplierRelationMapper.updateStatus("tenant-1", "rel-1", "待准入", "准入审批中"))
        .thenReturn(1);
    when(approvalTaskMapper.findByTenantAndId(org.mockito.ArgumentMatchers.eq("tenant-1"), org.mockito.ArgumentMatchers.any()))
        .thenReturn(task("approval-1", "tenant-1", "rel-1", "待审批"));
    when(buyerUserMapper.findDefaultApproverId("tenant-1", "role-buyer-owner"))
        .thenReturn("user-buyer-owner");

    ApprovalTaskResponse response = buyerSupplierApplicationService.submitAdmission("rel-1");

    assertThat(response.bizType()).isEqualTo("buyer_supplier_admission");
    assertThat(response.status()).isEqualTo("待审批");
    verify(buyerSupplierRelationMapper).updateStatus("tenant-1", "rel-1", "待准入", "准入审批中");
    verify(approvalTaskMapper).insert(
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("buyer_supplier_admission"),
        org.mockito.ArgumentMatchers.eq("rel-1"),
        org.mockito.ArgumentMatchers.eq("user-buyer-owner"),
        org.mockito.ArgumentMatchers.eq("待审批"));
    verify(auditLogApplicationService).recordTenantAction(
        "buyer_supplier_admission.submitted",
        "buyer_supplier_relation",
        "rel-1");
  }

  @Test
  void reviewApprovesInApprovalSupplierRelationAndCompletesPendingTask() {
    TenantContext.set("tenant-1", null, "approver-1");
    when(buyerSupplierRelationMapper.findByTenantAndId("tenant-1", "rel-1"))
        .thenReturn(relation("rel-1", "tenant-1", "准入审批中"));
    when(approvalTaskMapper.findPendingByBiz("tenant-1", "buyer_supplier_admission", "rel-1", "待审批"))
        .thenReturn(task("approval-1", "tenant-1", "rel-1", "待审批"));
    when(approvalTaskMapper.updateStatus("tenant-1", "approval-1", "待审批", "已通过", "approver-1"))
        .thenReturn(1);
    when(buyerSupplierRelationMapper.updateStatus("tenant-1", "rel-1", "准入审批中", "已准入"))
        .thenReturn(1);
    when(approvalTaskMapper.findByTenantAndId("tenant-1", "approval-1"))
        .thenReturn(task("approval-1", "tenant-1", "rel-1", "已通过"));

    ApprovalTaskResponse response = buyerSupplierApplicationService.reviewAdmission(
        "rel-1",
        new ReviewBuyerSupplierAdmissionRequest(true));

    assertThat(response.status()).isEqualTo("已通过");
    verify(buyerSupplierRelationMapper).updateStatus("tenant-1", "rel-1", "准入审批中", "已准入");
    verify(auditLogApplicationService).recordTenantAction(
        "buyer_supplier_admission.approved",
        "buyer_supplier_relation",
        "rel-1");
  }

  @Test
  void reviewRejectsSupplierRelationThatIsNotInApproval() {
    TenantContext.set("tenant-1", null, "approver-1");
    when(buyerSupplierRelationMapper.findByTenantAndId("tenant-1", "rel-1"))
        .thenReturn(relation("rel-1", "tenant-1", "待准入"));

    assertThatThrownBy(() -> buyerSupplierApplicationService.reviewAdmission(
        "rel-1",
        new ReviewBuyerSupplierAdmissionRequest(true)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only supplier relations in admission approval can be reviewed");
  }

  private BuyerSupplierRelation relation(String id, String tenantId, String status) {
    return new BuyerSupplierRelation(
        id,
        tenantId,
        "supplier-1",
        "晨光供应商",
        status,
        "A",
        "[\"办公设备\"]",
        BigDecimal.valueOf(90));
  }

  private ApprovalTask task(String id, String tenantId, String relationId, String status) {
    return new ApprovalTask(
        id,
        tenantId,
        "buyer_supplier_admission",
        relationId,
        "approver-1",
        status,
        OffsetDateTime.parse("2026-06-15T10:30:00+08:00"));
  }
}
