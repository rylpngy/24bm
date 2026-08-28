package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.domain.ApprovalTemplate;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.common.api.ApprovalTaskResponse;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.supplier.api.BuyerSupplierResponse;
import com.procurement.supplier.api.ChangeBuyerSupplierProfileRequest;
import com.procurement.supplier.api.ChangeBuyerSupplierPerformanceRequest;
import com.procurement.supplier.api.ChangeBuyerSupplierStatusRequest;
import com.procurement.supplier.api.ReviewBuyerSupplierAdmissionRequest;
import com.procurement.supplier.api.SupplierQualificationResponse;
import com.procurement.supplier.application.BuyerSupplierApplicationService;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.domain.BuyerSupplierAdmissionStatusTransition;
import com.procurement.supplier.domain.BuyerSupplierManualStatusTransition;
import com.procurement.supplier.domain.SupplierQualification;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class BuyerSupplierAdmissionApprovalStateTransitionTests {

  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper =
      org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
  private final SupplierQualificationMapper supplierQualificationMapper =
      org.mockito.Mockito.mock(SupplierQualificationMapper.class);
  private final ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
  private final ApprovalTemplateMapper approvalTemplateMapper = org.mockito.Mockito.mock(ApprovalTemplateMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final ApprovalTaskApplicationService approvalTaskApplicationService =
      new ApprovalTaskApplicationService(approvalTaskMapper, approvalTemplateMapper, buyerUserMapper);
  private final AuditLogApplicationService auditLogApplicationService = org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final BuyerSupplierApplicationService buyerSupplierApplicationService =
      new BuyerSupplierApplicationService(
          buyerSupplierRelationMapper,
          supplierQualificationMapper,
          new ObjectMapper(),
          approvalTaskMapper,
          approvalTaskApplicationService,
      com.procurement.TestApprovalGates.alwaysOn(),
          auditLogApplicationService,
          notificationApplicationService,
          new BuyerSupplierAdmissionStatusTransition(),
          new BuyerSupplierManualStatusTransition(),
      org.mockito.Mockito.mock(com.procurement.supplier.infrastructure.SupplierProfileMapper.class),
      org.mockito.Mockito.mock(com.procurement.supplier.application.SupplierQualificationApplicationService.class));

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void submitCreatesPendingAdmissionApprovalForPendingSupplierRelation() {
    TenantContext.set("tenant-1", null, "buyer-1");
    when(buyerSupplierRelationMapper.findByTenantAndId("tenant-1", "rel-1"))
        .thenReturn(relation("rel-1", "tenant-1", "待准入"));
    when(supplierQualificationMapper.listActiveBySupplier("supplier-1"))
        .thenReturn(List.of(qualification("qual-1", "supplier-1")));
    when(buyerSupplierRelationMapper.updateStatus("tenant-1", "rel-1", "待准入", "准入审批中"))
        .thenReturn(1);
    when(approvalTaskMapper.findByTenantAndId(org.mockito.ArgumentMatchers.eq("tenant-1"), org.mockito.ArgumentMatchers.any()))
        .thenReturn(task("approval-1", "tenant-1", "rel-1", "待审批"));
    when(approvalTemplateMapper.findActiveByTenantAndBizType("tenant-1", "buyer_supplier_admission"))
        .thenReturn(template("TPL_SUPPLIER_ADMISSION", "buyer_supplier_admission"));
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
  void submitAdmissionRejectsSupplierRelationWithoutActiveQualifications() {
    TenantContext.set("tenant-1", null, "buyer-1");
    when(buyerSupplierRelationMapper.findByTenantAndId("tenant-1", "rel-1"))
        .thenReturn(relation("rel-1", "tenant-1", "待准入"));
    when(supplierQualificationMapper.listActiveBySupplier("supplier-1"))
        .thenReturn(List.of());

    assertThatThrownBy(() -> buyerSupplierApplicationService.submitAdmission("rel-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Supplier admission requires at least one active qualification");
  }

  private ApprovalTemplate template(String code, String bizType) {
    return new ApprovalTemplate(code, "tenant-1", bizType, "审批模板", "role-buyer-owner", "active");
  }

  @Test
  void reviewApprovesInApprovalSupplierRelationAndCompletesPendingTask() {
    TenantContext.set("tenant-1", null, "approver-1");
    when(buyerSupplierRelationMapper.findByTenantAndId("tenant-1", "rel-1"))
        .thenReturn(relation("rel-1", "tenant-1", "准入审批中"));
    when(approvalTaskMapper.findPendingByBiz("tenant-1", "buyer_supplier_admission", "rel-1", "待审批"))
        .thenReturn(task("approval-1", "tenant-1", "rel-1", "待审批"));
    when(approvalTaskMapper.updateStatus("tenant-1", "approval-1", "待审批", "已通过", "approver-1", null))
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
    verify(notificationApplicationService).notifyActiveTenantUsers(
        "tenant-1",
        "供应商准入审批已通过",
        "晨光供应商准入审批已通过。");
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

  @Test
  void changeSupplierRelationStatusCanBlacklistAdmittedSupplier() {
    TenantContext.set("tenant-1", null, "buyer-1");
    when(buyerSupplierRelationMapper.findByTenantAndId("tenant-1", "rel-1"))
        .thenReturn(relation("rel-1", "tenant-1", "已准入"))
        .thenReturn(relation("rel-1", "tenant-1", "黑名单"));
    when(buyerSupplierRelationMapper.updateStatus("tenant-1", "rel-1", "已准入", "黑名单"))
        .thenReturn(1);

    org.assertj.core.api.Assertions.assertThat(buyerSupplierApplicationService.changeRelationStatus(
            "rel-1",
            new ChangeBuyerSupplierStatusRequest("黑名单")).status())
        .isEqualTo("黑名单");

    verify(auditLogApplicationService).recordTenantAction(
        "buyer_supplier_relation.status_changed",
        "buyer_supplier_relation",
        "rel-1");
  }

  @Test
  void changeSupplierRelationStatusDoesNotBypassAdmissionApproval() {
    TenantContext.set("tenant-1", null, "buyer-1");
    when(buyerSupplierRelationMapper.findByTenantAndId("tenant-1", "rel-1"))
        .thenReturn(relation("rel-1", "tenant-1", "待准入"));

    assertThatThrownBy(() -> buyerSupplierApplicationService.changeRelationStatus(
        "rel-1",
        new ChangeBuyerSupplierStatusRequest("已准入")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported buyer supplier relation target status");
  }

  @Test
  void changeSupplierRelationProfileUpdatesLevelAndCategoriesInCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-1");
    when(buyerSupplierRelationMapper.findByTenantAndId("tenant-1", "rel-1"))
        .thenReturn(relation("rel-1", "tenant-1", "已准入"))
        .thenReturn(new BuyerSupplierRelation(
            "rel-1",
            "tenant-1",
            "supplier-1",
            "晨光供应商",
            "已准入",
            "S",
            "[\"办公设备\",\"电脑整机\"]",
            BigDecimal.valueOf(90), "合格", null, "91310000MA1FL00001", "王法人", "李采购", "13900000000", "sales@demo.com", "电子元器件批发；五金交电销售", "招商银行上海分行", "6225880000000001"));

    buyerSupplierApplicationService.changeRelationProfile(
        "rel-1",
        new ChangeBuyerSupplierProfileRequest("S", java.util.List.of("办公设备", "电脑整机")));

    verify(buyerSupplierRelationMapper).updateProfile(
        "tenant-1",
        "rel-1",
        "S",
        "[\"办公设备\",\"电脑整机\"]");
    verify(auditLogApplicationService).recordTenantAction(
        "buyer_supplier_relation.profile_updated",
        "buyer_supplier_relation",
        "rel-1");
  }

  @Test
  void changeSupplierRelationPerformanceUpdatesScoreInCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-1");
    when(buyerSupplierRelationMapper.findByTenantAndId("tenant-1", "rel-1"))
        .thenReturn(relation("rel-1", "tenant-1", "已准入"))
        .thenReturn(new BuyerSupplierRelation(
            "rel-1",
            "tenant-1",
            "supplier-1",
            "晨光供应商",
            "已准入",
            "A",
            "[\"办公设备\"]",
            BigDecimal.valueOf(96.50), "合格", null, "91310000MA1FL00001", "王法人", "李采购", "13900000000", "sales@demo.com", "电子元器件批发；五金交电销售", "招商银行上海分行", "6225880000000001"));

    BuyerSupplierResponse response = buyerSupplierApplicationService.changeRelationPerformance(
        "rel-1",
        new ChangeBuyerSupplierPerformanceRequest(BigDecimal.valueOf(96.50)));

    assertThat(response.performanceScore()).isEqualByComparingTo("96.50");
    verify(buyerSupplierRelationMapper).updatePerformanceScore(
        "tenant-1",
        "rel-1",
        BigDecimal.valueOf(96.50));
    verify(auditLogApplicationService).recordTenantAction(
        "buyer_supplier_relation.performance_updated",
        "buyer_supplier_relation",
        "rel-1");
  }

  @Test
  void changeSupplierRelationPerformanceRejectsScoreOutsideRange() {
    TenantContext.set("tenant-1", null, "buyer-1");

    assertThatThrownBy(() -> buyerSupplierApplicationService.changeRelationPerformance(
        "rel-1",
        new ChangeBuyerSupplierPerformanceRequest(BigDecimal.valueOf(120))))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Supplier performance score must be between 0 and 100");
  }

  @Test
  void listSupplierRelationsAppliesFiltersInsideCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-1");

    buyerSupplierApplicationService.listCurrentTenantSuppliers(
        "已准入",
        "S",
        "办公设备",
        "晨光");

    verify(buyerSupplierRelationMapper).listByTenant(
        "tenant-1",
        "已准入",
        "S",
        "办公设备",
        "晨光");
  }

  @Test
  void listRelationQualificationsUsesTenantRelationScopeBeforeReadingSupplierQualifications() {
    TenantContext.set("tenant-1", null, "buyer-1");
    when(buyerSupplierRelationMapper.findByTenantAndId("tenant-1", "rel-1"))
        .thenReturn(relation("rel-1", "tenant-1", "待准入"));
    when(supplierQualificationMapper.listActiveBySupplier("supplier-1"))
        .thenReturn(List.of(qualification("qual-1", "supplier-1")));

    List<SupplierQualificationResponse> qualifications =
        buyerSupplierApplicationService.listRelationQualifications("rel-1");

    assertThat(qualifications).hasSize(1);
    assertThat(qualifications.get(0).qualificationType()).isEqualTo("营业执照");
    verify(buyerSupplierRelationMapper).findByTenantAndId("tenant-1", "rel-1");
    verify(supplierQualificationMapper).listActiveBySupplier("supplier-1");
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
        BigDecimal.valueOf(90), "合格", null, "91310000MA1FL00001", "王法人", "李采购", "13900000000", "sales@demo.com", "电子元器件批发；五金交电销售", "招商银行上海分行", "6225880000000001");
  }

  private ApprovalTask task(String id, String tenantId, String relationId, String status) {
    return new ApprovalTask(
        id,
        tenantId,
        "buyer_supplier_admission",
        relationId,
        "approver-1",
        status,
        OffsetDateTime.parse("2026-06-15T10:30:00+08:00"),
        null);
  }

  private SupplierQualification qualification(String id, String supplierId) {
    return new SupplierQualification(
        id,
        supplierId,
        "营业执照",
        "Q-2026-001",
        LocalDate.now().plusYears(1),
        "营业执照.pdf",
        "supplier/qualifications/business-license.pdf",
        "active",
        OffsetDateTime.parse("2026-06-22T10:00:00+08:00"));
  }
}
