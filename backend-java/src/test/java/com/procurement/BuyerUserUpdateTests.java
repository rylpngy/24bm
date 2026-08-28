package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.api.UpdateBuyerUserRequest;
import com.procurement.identity.application.BuyerUserApplicationService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.domain.BuyerUserStatusTransition;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.tenant.application.TenantEntitlementApplicationService;
import com.procurement.tenant.infrastructure.TenantEntitlementMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class BuyerUserUpdateTests {

  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final DepartmentMapper departmentMapper = org.mockito.Mockito.mock(DepartmentMapper.class);
  private final TenantEntitlementMapper tenantEntitlementMapper = org.mockito.Mockito.mock(TenantEntitlementMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final PermissionService permissionService = org.mockito.Mockito.mock(PermissionService.class);
  private final BuyerUserApplicationService service = new BuyerUserApplicationService(
      buyerUserMapper,
      departmentMapper,
      new TenantEntitlementApplicationService(tenantEntitlementMapper),
      auditLogApplicationService,
      org.mockito.Mockito.mock(PasswordEncoder.class),
      new BuyerUserStatusTransition(),
      permissionService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void updatesMemberDepartmentAndRoleAndClearsOldManagerAssignment() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    BuyerUser current = new BuyerUser(
        "user-1", "tenant-1", "王采购", "13800000000", "old@example.com", "active",
        "dept-old", "role-buyer-requester", "EMP-01", "采购专员");
    BuyerUser updated = new BuyerUser(
        "user-1", "tenant-1", "王采购", "13900000000", "new@example.com", "active",
        "dept-purchase", "role-buyer-finance", "EMP-01", "采购主管");
    when(buyerUserMapper.existsByTenantAndId("tenant-1", "user-1")).thenReturn(true);
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-purchase")).thenReturn(true);
    when(buyerUserMapper.existsBuyerRoleByTenantAndId("tenant-1", "role-buyer-finance")).thenReturn(true);
    when(buyerUserMapper.findByTenantAndId("tenant-1", "user-1")).thenReturn(current, updated);
    when(buyerUserMapper.findBuyerRoleNameByTenantAndId("tenant-1", "role-buyer-requester"))
        .thenReturn("采购申请员");
    when(buyerUserMapper.findBuyerRoleNameByTenantAndId("tenant-1", "role-buyer-finance"))
        .thenReturn("财务专员");

    service.updateUser("user-1", new UpdateBuyerUserRequest(
        "王采购", "13900000000", "new@example.com", "dept-purchase", "role-buyer-finance",
        "EMP-01", "采购主管"));

    verify(buyerUserMapper).updateDetails(
        "tenant-1", "user-1", "王采购", "13900000000", "new@example.com",
        "dept-purchase", "EMP-01", "采购主管");
    verify(buyerUserMapper).replaceRole("tenant-1", "user-1", "role-buyer-finance");
    verify(departmentMapper).clearManagerByUserIdExceptDepartment("tenant-1", "user-1", "dept-purchase");
    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("buyer_user.updated"),
        org.mockito.ArgumentMatchers.eq("buyer_user"),
        org.mockito.ArgumentMatchers.eq("user-1"),
        org.mockito.ArgumentMatchers.contains("部门: dept-old → dept-purchase"));
  }
}
