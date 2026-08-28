package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.api.CreateBuyerUserRequest;
import com.procurement.identity.application.BuyerUserApplicationService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.BuyerUserStatusTransition;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.tenant.application.TenantEntitlementApplicationService;
import com.procurement.tenant.infrastructure.TenantEntitlementMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class BuyerUserLimitTests {

  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final DepartmentMapper departmentMapper = org.mockito.Mockito.mock(DepartmentMapper.class);
  private final TenantEntitlementMapper tenantEntitlementMapper =
      org.mockito.Mockito.mock(TenantEntitlementMapper.class);
  private final TenantEntitlementApplicationService tenantEntitlementApplicationService =
      new TenantEntitlementApplicationService(tenantEntitlementMapper);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final PasswordEncoder passwordEncoder = org.mockito.Mockito.mock(PasswordEncoder.class);
  private final PermissionService permissionService = org.mockito.Mockito.mock(PermissionService.class);
  private final BuyerUserApplicationService buyerUserApplicationService =
      new BuyerUserApplicationService(
          buyerUserMapper,
          departmentMapper,
          tenantEntitlementApplicationService,
          auditLogApplicationService,
          passwordEncoder,
          new BuyerUserStatusTransition(),
          permissionService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void createUserRejectsWhenTenantUserLimitIsReachedBeforeInsert() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(tenantEntitlementMapper.findUserLimit("tenant-1")).thenReturn(2);
    when(buyerUserMapper.countByTenant("tenant-1")).thenReturn(2);

    assertThatThrownBy(() -> buyerUserApplicationService.createUser(new CreateBuyerUserRequest(
        "新增用户",
        "13900000000",
        "new.user@example.com",
        "active",
        "dept-it",
        "role-buyer-requester",
        "new-password")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Tenant user limit reached: 2");

    verify(buyerUserMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any());
  }

  @Test
  void createUserRejectsTenantWithoutConfiguredUserCapacityBeforeInsert() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(tenantEntitlementMapper.findUserLimit("tenant-1")).thenReturn(0);

    assertThatThrownBy(() -> buyerUserApplicationService.createUser(new CreateBuyerUserRequest(
        "新增用户",
        "13900000000",
        "new.user@example.com",
        "active",
        "dept-it",
        "role-buyer-requester",
        "new-password")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Tenant user limit reached: 0");

    verify(buyerUserMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any());
  }
}
