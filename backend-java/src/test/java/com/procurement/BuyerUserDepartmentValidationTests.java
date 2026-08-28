package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
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
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.tenant.application.TenantEntitlementApplicationService;
import com.procurement.tenant.infrastructure.TenantEntitlementMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class BuyerUserDepartmentValidationTests {

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
  void createUserRejectsDepartmentOutsideCurrentTenantBeforeInsert() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(tenantEntitlementMapper.findUserLimit("tenant-1")).thenReturn(10);
    when(buyerUserMapper.countByTenant("tenant-1")).thenReturn(1);
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-other")).thenReturn(false);

    assertThatThrownBy(() -> buyerUserApplicationService.createUser(new CreateBuyerUserRequest(
        "新增用户",
        "13900000000",
        "new.user@example.com",
        "active",
        "dept-other",
        "role-buyer-requester",
        "new-password")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Department not found in tenant scope: dept-other");

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
  void createUserPersistsActiveDepartmentInCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(tenantEntitlementMapper.findUserLimit("tenant-1")).thenReturn(10);
    when(buyerUserMapper.countByTenant("tenant-1")).thenReturn(1);
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-it")).thenReturn(true);
    when(buyerUserMapper.existsBuyerRoleByTenantAndId("tenant-1", "role-buyer-requester")).thenReturn(true);
    when(passwordEncoder.encode("new-password")).thenReturn("{bcrypt}new-user-hash");
    when(buyerUserMapper.findByTenantAndId(
            org.mockito.ArgumentMatchers.eq("tenant-1"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> user(invocation.getArgument(1)));

    var response = buyerUserApplicationService.createUser(new CreateBuyerUserRequest(
        "新增用户",
        "13900000000",
        "new.user@example.com",
        "active",
        "dept-it",
        "role-buyer-requester",
        "new-password"));

    assertThat(response.departmentId()).isEqualTo("dept-it");
    verify(buyerUserMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("user-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("新增用户"),
        org.mockito.ArgumentMatchers.eq("13900000000"),
        org.mockito.ArgumentMatchers.eq("new.user@example.com"),
        org.mockito.ArgumentMatchers.eq("active"),
        org.mockito.ArgumentMatchers.eq("dept-it"),
        org.mockito.ArgumentMatchers.eq("{bcrypt}new-user-hash"),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.eq(""));
  }

  private BuyerUser user(String id) {
    return new BuyerUser(
        id,
        "tenant-1",
        "新增用户",
        "13900000000",
        "new.user@example.com",
        "active",
        "dept-it",
        "role-buyer-requester");
  }
}
