package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.catalog.api.CreateMaterialRequest;
import com.procurement.catalog.application.MaterialApplicationService;
import com.procurement.catalog.domain.Material;
import com.procurement.catalog.infrastructure.MaterialMapper;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.api.CreateBuyerUserRequest;
import com.procurement.identity.application.BuyerUserApplicationService;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.supplier.api.CreateBuyerSupplierRequest;
import com.procurement.supplier.application.BuyerSupplierApplicationService;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.tenant.application.TenantEntitlementApplicationService;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

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
    BuyerUserApplicationService buyerUserApplicationService =
        new BuyerUserApplicationService(
            buyerUserMapper,
            departmentMapper,
            tenantEntitlementApplicationService,
            auditLogApplicationService);
    when(buyerUserMapper.countByTenant("tenant-1")).thenReturn(3);
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-it")).thenReturn(true);
    when(buyerUserMapper.existsBuyerRoleByTenantAndId("tenant-1", "role-buyer-requester")).thenReturn(true);
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
        "role-buyer-requester"));

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
    MaterialApplicationService materialApplicationService =
        new MaterialApplicationService(materialMapper, auditLogApplicationService);
    when(materialMapper.findByTenantAndId(
            org.mockito.ArgumentMatchers.eq("tenant-1"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> material(invocation.getArgument(1)));

    materialApplicationService.createMaterial(new CreateMaterialRequest(
        "MAT-001",
        "办公椅",
        "办公家具",
        "把",
        BigDecimal.valueOf(300)));

    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("material.created"),
        org.mockito.ArgumentMatchers.eq("material"),
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("mat-")));
  }

  @Test
  void buyerSupplierRelationCreationRecordsAuditLog() {
    TenantContext.set("tenant-1", null, "buyer-admin");
    BuyerSupplierRelationMapper buyerSupplierRelationMapper =
        org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
    ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
    BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
    BuyerSupplierApplicationService buyerSupplierApplicationService =
        new BuyerSupplierApplicationService(
            buyerSupplierRelationMapper,
            new ObjectMapper(),
            approvalTaskMapper,
            new ApprovalTaskApplicationService(approvalTaskMapper, buyerUserMapper),
            auditLogApplicationService);
    when(buyerSupplierRelationMapper.findByTenantAndId(
            org.mockito.ArgumentMatchers.eq("tenant-1"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> relation(invocation.getArgument(1)));

    buyerSupplierApplicationService.createSupplierRelation(new CreateBuyerSupplierRequest(
        "supplier-1",
        "待准入",
        "A",
        List.of("办公设备")));

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
    return new Material(id, "tenant-1", "MAT-001", "办公椅", "办公家具", "把", BigDecimal.valueOf(300));
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
        BigDecimal.valueOf(90));
  }
}
