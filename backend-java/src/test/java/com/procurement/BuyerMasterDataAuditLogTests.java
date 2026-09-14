package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.catalog.api.CreateMaterialRequest;
import com.procurement.catalog.application.MaterialApplicationService;
import com.procurement.catalog.domain.Material;
import com.procurement.catalog.infrastructure.MaterialMapper;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.api.CreateBuyerUserRequest;
import com.procurement.identity.application.BuyerUserApplicationService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.BuyerUserStatusTransition;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.supplier.api.CreateBuyerSupplierRequest;
import com.procurement.supplier.application.BuyerSupplierApplicationService;
import com.procurement.supplier.domain.BuyerSupplierAdmissionStatusTransition;
import com.procurement.supplier.domain.BuyerSupplierManualStatusTransition;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import com.procurement.tenant.application.TenantEntitlementApplicationService;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class BuyerMasterDataAuditLogTests {

  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void buyerUserCreationRecordsAuditLog() {
    TenantContext.set("tenant-1", null, "buyer-admin");
    BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
    DepartmentMapper departmentMapper = org.mockito.Mockito.mock(DepartmentMapper.class);
    TenantEntitlementApplicationService tenantEntitlementApplicationService =
        org.mockito.Mockito.mock(TenantEntitlementApplicationService.class);
    PasswordEncoder passwordEncoder = org.mockito.Mockito.mock(PasswordEncoder.class);
    PermissionService permissionService = org.mockito.Mockito.mock(PermissionService.class);
    BuyerUserApplicationService buyerUserApplicationService =
        new BuyerUserApplicationService(
            buyerUserMapper,
            departmentMapper,
            tenantEntitlementApplicationService,
            auditLogApplicationService,
            passwordEncoder,
            new BuyerUserStatusTransition(),
            permissionService);
    when(buyerUserMapper.countByTenant("tenant-1")).thenReturn(3);
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-it")).thenReturn(true);
    when(buyerUserMapper.existsBuyerRoleByTenantAndId("tenant-1", "role-buyer-requester")).thenReturn(true);
    when(passwordEncoder.encode("new-password")).thenReturn("{bcrypt}new-user-hash");
    when(buyerUserMapper.findByTenantAndId(
            org.mockito.ArgumentMatchers.eq("tenant-1"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> user(invocation.getArgument(1)));

    buyerUserApplicationService.createUser(new CreateBuyerUserRequest(
        "采购员",
        "13900000001",
        "buyer@example.com",
        "active",
        "dept-it",
        "role-buyer-requester",
        "new-password"));

    verify(tenantEntitlementApplicationService).requireUserCapacity("tenant-1", 3);
    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("buyer_user.created"),
        org.mockito.ArgumentMatchers.eq("buyer_user"),
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("user-")));
  }

  @Test
  void materialCreationRecordsAuditLog() {
    TenantContext.set("tenant-1", null, "buyer-admin");
    MaterialMapper materialMapper = org.mockito.Mockito.mock(MaterialMapper.class);
    org.springframework.context.ApplicationEventPublisher eventPublisher =
        org.mockito.Mockito.mock(org.springframework.context.ApplicationEventPublisher.class);
    MaterialApplicationService materialApplicationService =
        new MaterialApplicationService(materialMapper, eventPublisher);
    when(materialMapper.findByTenantAndId(
            org.mockito.ArgumentMatchers.eq("tenant-1"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> material(invocation.getArgument(1)));

    materialApplicationService.createMaterial(new CreateMaterialRequest(
        "MAT-001",
        "办公椅",
        "办公家具",
        "把",
        BigDecimal.valueOf(300), "i7/16G/512G SSD", "演示品牌", true, java.math.BigDecimal.valueOf(13.00), "演示物料描述"));

    verify(eventPublisher).publishEvent(
        org.mockito.ArgumentMatchers.<Object>argThat(ev ->
            ev instanceof com.procurement.common.event.DomainAuditEvent e
                && e.action().equals("material.created")
                && e.targetType().equals("material")
                && e.targetId() != null
                && e.targetId().startsWith("mat-")));
  }

  @Test
  void materialUpdateRecordsAuditLogAndUsesCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-admin");
    MaterialMapper materialMapper = org.mockito.Mockito.mock(MaterialMapper.class);
    org.springframework.context.ApplicationEventPublisher eventPublisher =
        org.mockito.Mockito.mock(org.springframework.context.ApplicationEventPublisher.class);
    MaterialApplicationService materialApplicationService =
        new MaterialApplicationService(materialMapper, eventPublisher);
    when(materialMapper.findByTenantAndId("tenant-1", "mat-1"))
        .thenReturn(material("mat-1"));

    materialApplicationService.updateMaterial(
        "mat-1",
        new CreateMaterialRequest(
            "MAT-002",
            "人体工学椅",
            "办公家具",
            "把",
            BigDecimal.valueOf(480), "i7/16G/512G SSD", "演示品牌", true, java.math.BigDecimal.valueOf(13.00), "演示物料描述"));

    verify(materialMapper).update(
        "tenant-1",
        "mat-1",
        "MAT-002",
        "人体工学椅",
        "办公家具",
        "把",
        BigDecimal.valueOf(480),
        "i7/16G/512G SSD",
        "演示品牌",
        true,
        java.math.BigDecimal.valueOf(13.00),
        "演示物料描述");
    verify(eventPublisher).publishEvent(
        new com.procurement.common.event.DomainAuditEvent("material.updated", "material", "mat-1"));
  }

  @Test
  void listMaterialsAppliesFiltersInsideCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-admin");
    MaterialMapper materialMapper = org.mockito.Mockito.mock(MaterialMapper.class);
    org.springframework.context.ApplicationEventPublisher eventPublisher =
        org.mockito.Mockito.mock(org.springframework.context.ApplicationEventPublisher.class);
    MaterialApplicationService materialApplicationService =
        new MaterialApplicationService(materialMapper, eventPublisher);

    materialApplicationService.listCurrentTenantMaterials("办公家具", "椅");

    verify(materialMapper).listByTenant("tenant-1", "办公家具", "椅");
  }

  @Test
  void buyerSupplierRelationCreationRecordsAuditLog() {
    TenantContext.set("tenant-1", null, "buyer-admin");
    BuyerSupplierRelationMapper buyerSupplierRelationMapper =
        org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
    ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
    ApprovalTemplateMapper approvalTemplateMapper = org.mockito.Mockito.mock(ApprovalTemplateMapper.class);
    BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
    NotificationApplicationService notificationApplicationService =
        org.mockito.Mockito.mock(NotificationApplicationService.class);
    BuyerSupplierApplicationService buyerSupplierApplicationService =
        new BuyerSupplierApplicationService(
            buyerSupplierRelationMapper,
            org.mockito.Mockito.mock(SupplierQualificationMapper.class),
            new ObjectMapper(),
            approvalTaskMapper,
            new ApprovalTaskApplicationService(approvalTaskMapper, approvalTemplateMapper, buyerUserMapper),
      com.procurement.TestApprovalGates.alwaysOn(),
            auditLogApplicationService,
            notificationApplicationService,
            new BuyerSupplierAdmissionStatusTransition(),
            new BuyerSupplierManualStatusTransition(),
      org.mockito.Mockito.mock(com.procurement.supplier.infrastructure.SupplierProfileMapper.class),
      org.mockito.Mockito.mock(com.procurement.supplier.application.SupplierQualificationApplicationService.class));
    when(buyerSupplierRelationMapper.findByTenantAndId(
            org.mockito.ArgumentMatchers.eq("tenant-1"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> relation(invocation.getArgument(1)));

    buyerSupplierApplicationService.createSupplierRelation(new CreateBuyerSupplierRequest(
        "supplier-1",
        "待准入",
        "A",
        List.of("办公设备"), null, null, null, null, null, null, null, null));

    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("buyer_supplier_relation.created"),
        org.mockito.ArgumentMatchers.eq("buyer_supplier_relation"),
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("bsr-")));
  }

  private BuyerUser user(String id) {
    return new BuyerUser(
        id,
        "tenant-1",
        "采购员",
        "13900000001",
        "buyer@example.com",
        "active",
        "dept-it",
        "role-buyer-requester");
  }

  private Material material(String id) {
    return new Material(id, "tenant-1", "MAT-001", "办公椅", "办公家具", "把", BigDecimal.valueOf(300), "i7/16G/512G SSD", "演示品牌", true, java.math.BigDecimal.valueOf(13.00), "演示物料描述");
  }

  private BuyerSupplierRelation relation(String id) {
    return new BuyerSupplierRelation(
        id,
        "tenant-1",
        "supplier-1",
        "晨光供应商",
        "待准入",
        "A",
        "[\"办公设备\"]",
        BigDecimal.valueOf(90), "合格", null, "91310000MA1FL00001", "王法人", "李采购", "13900000000", "sales@demo.com", "电子元器件批发；五金交电销售", "招商银行上海分行", "6225880000000001");
  }
}
