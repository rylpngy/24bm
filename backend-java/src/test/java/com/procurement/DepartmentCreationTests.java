package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.organization.api.CreateDepartmentRequest;
import com.procurement.organization.application.DepartmentApplicationService;
import com.procurement.organization.domain.Department;
import com.procurement.organization.infrastructure.DepartmentMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class DepartmentCreationTests {

  private final DepartmentMapper departmentMapper = org.mockito.Mockito.mock(DepartmentMapper.class);
  private final PurchaseDemandMapper purchaseDemandMapper = org.mockito.Mockito.mock(PurchaseDemandMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final DepartmentApplicationService departmentApplicationService =
      new DepartmentApplicationService(departmentMapper, purchaseDemandMapper, auditLogApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void createsActiveDepartmentInCurrentTenantAndRecordsAuditLog() {
    TenantContext.set("tenant-1", null, "buyer-admin");
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-parent")).thenReturn(true);
    when(departmentMapper.findByTenantAndId(
            org.mockito.ArgumentMatchers.eq("tenant-1"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> department(invocation.getArgument(1)));

    var response = departmentApplicationService.createDepartment(new CreateDepartmentRequest(
        "研发采购部",
        "dept-parent"));

    assertThat(response.tenantId()).isEqualTo("tenant-1");
    assertThat(response.name()).isEqualTo("研发采购部");
    assertThat(response.parentId()).isEqualTo("dept-parent");
    assertThat(response.status()).isEqualTo("active");
    verify(departmentMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("dept-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("研发采购部"),
        org.mockito.ArgumentMatchers.eq("dept-parent"),
        org.mockito.ArgumentMatchers.eq("active"));
    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("department.created"),
        org.mockito.ArgumentMatchers.eq("department"),
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("dept-")));
  }

  @Test
  void rejectsParentDepartmentOutsideCurrentTenantBeforeInsert() {
    TenantContext.set("tenant-1", null, "buyer-admin");
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-other")).thenReturn(false);

    assertThatThrownBy(() -> departmentApplicationService.createDepartment(new CreateDepartmentRequest(
        "研发采购部",
        "dept-other")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Parent department not found in tenant scope: dept-other");

    verify(departmentMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
    verify(auditLogApplicationService, never()).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("department.created"),
        org.mockito.ArgumentMatchers.eq("department"),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void disablesDepartmentWhenNoPurchaseDemandReferencesIt() {
    TenantContext.set("tenant-1", null, "buyer-admin");
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-old")).thenReturn(true);
    when(purchaseDemandMapper.countByTenantAndDepartment("tenant-1", "dept-old")).thenReturn(0);
    when(departmentMapper.updateStatus("tenant-1", "dept-old", "active", "inactive")).thenReturn(1);
    when(departmentMapper.findByTenantAndId("tenant-1", "dept-old"))
        .thenReturn(new Department("dept-old", "tenant-1", "历史部门", null, "inactive"));

    var response = departmentApplicationService.disableDepartment("dept-old");

    assertThat(response.id()).isEqualTo("dept-old");
    assertThat(response.status()).isEqualTo("inactive");
    verify(departmentMapper).updateStatus("tenant-1", "dept-old", "active", "inactive");
    verify(auditLogApplicationService).recordTenantAction(
        "department.disabled",
        "department",
        "dept-old");
  }

  @Test
  void rejectsDisablingDepartmentReferencedByPurchaseDemands() {
    TenantContext.set("tenant-1", null, "buyer-admin");
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-used")).thenReturn(true);
    when(purchaseDemandMapper.countByTenantAndDepartment("tenant-1", "dept-used")).thenReturn(2);

    assertThatThrownBy(() -> departmentApplicationService.disableDepartment("dept-used"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Department is referenced by purchase demands: dept-used");

    verify(departmentMapper, never()).updateStatus(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
    verify(auditLogApplicationService, never()).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("department.disabled"),
        org.mockito.ArgumentMatchers.eq("department"),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void updatesDepartmentDetailsAndRecordsAuditWithRenameDetail() {
    TenantContext.set("tenant-1", null, "buyer-admin");
    when(departmentMapper.findByTenantAndId("tenant-1", "dept-1")).thenReturn(department("dept-1"));

    departmentApplicationService.updateDepartment("dept-1",
        new com.procurement.organization.api.UpdateDepartmentRequest("采购部", "统筹采购", "user-1"));

    verify(departmentMapper).updateDetails("tenant-1", "dept-1", "采购部", "统筹采购", "user-1");
    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("department.updated"),
        org.mockito.ArgumentMatchers.eq("department"),
        org.mockito.ArgumentMatchers.eq("dept-1"),
        org.mockito.ArgumentMatchers.contains("研发采购部 → 采购部"));
  }

  @Test
  void updateRejectsUnknownDepartment() {
    TenantContext.set("tenant-1", null, "buyer-admin");
    when(departmentMapper.findByTenantAndId("tenant-1", "ghost")).thenReturn(null);

    assertThatThrownBy(() -> departmentApplicationService.updateDepartment("ghost",
        new com.procurement.organization.api.UpdateDepartmentRequest("X", null, null)))
        .isInstanceOf(IllegalArgumentException.class);

    verify(departmentMapper, never()).updateDetails(
        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any());
  }

  private Department department(String id) {
    return new Department(id, "tenant-1", "研发采购部", "dept-parent", "active");
  }
}
