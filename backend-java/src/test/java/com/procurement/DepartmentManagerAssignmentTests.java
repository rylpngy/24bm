package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.organization.api.UpdateDepartmentRequest;
import com.procurement.organization.application.DepartmentApplicationService;
import com.procurement.organization.domain.Department;
import com.procurement.organization.infrastructure.DepartmentMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class DepartmentManagerAssignmentTests {

  private final DepartmentMapper departmentMapper = org.mockito.Mockito.mock(DepartmentMapper.class);
  private final PurchaseDemandMapper purchaseDemandMapper = org.mockito.Mockito.mock(PurchaseDemandMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final PermissionService permissionService = org.mockito.Mockito.mock(PermissionService.class);
  private final DepartmentApplicationService service = new DepartmentApplicationService(
      departmentMapper,
      purchaseDemandMapper,
      auditLogApplicationService,
      buyerUserMapper,
      permissionService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void transfersActiveMemberThenAssignsAsDepartmentManager() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    Department department = new Department("dept-purchase", "tenant-1", "采购部", null, "active");
    when(departmentMapper.findByTenantAndId("tenant-1", "dept-purchase")).thenReturn(department);
    when(buyerUserMapper.findByTenantAndId("tenant-1", "user-fin")).thenReturn(new BuyerUser(
        "user-fin", "tenant-1", "李财务", "", "", "active", "dept-finance", "role-buyer-finance"));
    when(buyerUserMapper.updateDepartment("tenant-1", "user-fin", "dept-purchase")).thenReturn(1);
    when(departmentMapper.existsActiveMemberByTenantAndDepartment(
        "tenant-1", "dept-purchase", "user-fin")).thenReturn(true);

    service.updateDepartment("dept-purchase", new UpdateDepartmentRequest(
        "采购部", "统一采购执行", "user-fin", true));

    verify(buyerUserMapper).updateDepartment("tenant-1", "user-fin", "dept-purchase");
    verify(departmentMapper).clearManagerByUserIdExceptDepartment(
        "tenant-1", "user-fin", "dept-purchase");
    verify(departmentMapper).updateDetails(
        "tenant-1", "dept-purchase", "采购部", "统一采购执行", "user-fin");
  }

  @Test
  void rejectsCrossDepartmentManagerWithoutExplicitTransfer() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(departmentMapper.findByTenantAndId("tenant-1", "dept-purchase"))
        .thenReturn(new Department("dept-purchase", "tenant-1", "采购部", null, "active"));
    when(buyerUserMapper.findByTenantAndId("tenant-1", "user-fin")).thenReturn(new BuyerUser(
        "user-fin", "tenant-1", "李财务", "", "", "active", "dept-finance", "role-buyer-finance"));

    assertThatThrownBy(() -> service.updateDepartment("dept-purchase", new UpdateDepartmentRequest(
        "采购部", "", "user-fin", false)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("负责人必须属于当前部门");

    verify(buyerUserMapper, never()).updateDepartment(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void appointsExistingDepartmentMemberWithoutMovingThem() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(departmentMapper.findByTenantAndId("tenant-1", "dept-purchase"))
        .thenReturn(new Department("dept-purchase", "tenant-1", "采购部", null, "active"));
    when(buyerUserMapper.findByTenantAndId("tenant-1", "user-1")).thenReturn(new BuyerUser(
        "user-1", "tenant-1", "Member", "", "", "active", "dept-purchase", "role-buyer-requester"));
    when(departmentMapper.existsActiveMemberByTenantAndDepartment("tenant-1", "dept-purchase", "user-1"))
        .thenReturn(true);
    service.updateDepartment("dept-purchase", new UpdateDepartmentRequest("采购部", "", "user-1", false));
    verify(departmentMapper).updateDetails("tenant-1", "dept-purchase", "采购部", "", "user-1");
    verify(buyerUserMapper, never()).updateDepartment(
        org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void inactiveMemberCannotBeAppointedEvenWithTransferConsent() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(departmentMapper.findByTenantAndId("tenant-1", "dept-purchase"))
        .thenReturn(new Department("dept-purchase", "tenant-1", "采购部", null, "active"));
    when(buyerUserMapper.findByTenantAndId("tenant-1", "user-1")).thenReturn(new BuyerUser(
        "user-1", "tenant-1", "Member", "", "", "inactive", "dept-other", "role-buyer-requester"));
    assertThatThrownBy(() -> service.updateDepartment("dept-purchase",
        new UpdateDepartmentRequest("采购部", "", "user-1", true)))
        .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("在职成员");
    verify(buyerUserMapper, never()).updateDepartment(
        org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
  }

  @org.junit.jupiter.params.ParameterizedTest
  @org.junit.jupiter.params.provider.ValueSource(strings = {"appointment", "transfer", "clear"})
  void locksTenantBeforePermissionsAndManagerValidationForEveryManagerChange(String operation) {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(departmentMapper.findByTenantAndId("tenant-1", "dept-purchase"))
        .thenReturn(new Department("dept-purchase", "tenant-1", "采购部", null, "active"));
    boolean transfer = "transfer".equals(operation);
    String managerId = "clear".equals(operation) ? null : "user-1";
    if (managerId != null) {
      when(buyerUserMapper.findByTenantAndId("tenant-1", managerId)).thenReturn(new BuyerUser(
          managerId, "tenant-1", "Member", "", "", "active",
          transfer ? "dept-other" : "dept-purchase", "role-buyer-requester"));
      when(buyerUserMapper.updateDepartment("tenant-1", managerId, "dept-purchase")).thenReturn(1);
      when(departmentMapper.existsActiveMemberByTenantAndDepartment("tenant-1", "dept-purchase", managerId))
          .thenReturn(true);
    }
    service.updateDepartment("dept-purchase", new UpdateDepartmentRequest("采购部", "", managerId, transfer));
    verify(buyerUserMapper, never()).lockAdministrationTenant("tenant-1");
    var order = org.mockito.Mockito.inOrder(buyerUserMapper, permissionService, departmentMapper);
    order.verify(departmentMapper).lockAdministrationTenant("tenant-1");
    order.verify(permissionService).require("buyer:role:manage");
    order.verify(departmentMapper).findByTenantAndId("tenant-1", "dept-purchase");
    if (managerId != null) order.verify(buyerUserMapper).findByTenantAndId("tenant-1", managerId);
  }
}
