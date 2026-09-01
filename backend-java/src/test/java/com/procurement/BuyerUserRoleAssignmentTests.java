package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.api.CreateBuyerUserRequest;
import com.procurement.identity.api.UpdateBuyerUserRolesRequest;
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

class BuyerUserRoleAssignmentTests {

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
  void createUserRejectsRoleOutsideCurrentBuyerTenantBeforeInsert() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(tenantEntitlementMapper.findUserLimit("tenant-1")).thenReturn(10);
    when(buyerUserMapper.countByTenant("tenant-1")).thenReturn(1);
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-it")).thenReturn(true);
    when(buyerUserMapper.existsBuyerRoleByTenantAndId("tenant-1", "role-other")).thenReturn(false);

    assertThatThrownBy(() -> buyerUserApplicationService.createUser(new CreateBuyerUserRequest(
        "新增用户",
        "13900000000",
        "new.user@example.com",
        "active",
        "dept-it",
        "role-other",
        "new-password")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Buyer role not found in tenant scope: role-other");

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
  void createUserAssignsCurrentTenantBuyerRole() {
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

    assertThat(response.roleId()).isEqualTo("role-buyer-requester");
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
    verify(buyerUserMapper).assignRole(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("user-")),
        org.mockito.ArgumentMatchers.eq("role-buyer-requester"));
  }

  @Test
  void createUserRejectsDuplicateEmployeeNumberWithinTenant() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(tenantEntitlementMapper.findUserLimit("tenant-1")).thenReturn(10);
    when(buyerUserMapper.countByTenant("tenant-1")).thenReturn(1);
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-it")).thenReturn(true);
    when(buyerUserMapper.existsBuyerRoleByTenantAndId("tenant-1", "role-buyer-requester")).thenReturn(true);
    when(buyerUserMapper.existsByEmployeeNoExcludingUser("tenant-1", "LDU100001", null)).thenReturn(true);

    assertThatThrownBy(() -> buyerUserApplicationService.createUser(new CreateBuyerUserRequest(
        "重复工号用户", "13900000000", "duplicate@example.com", "active", "dept-it",
        "role-buyer-requester", "new-password", "ldu100001", "采购员")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("工号已存在");

    verify(buyerUserMapper, never()).assignRole(
        org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void updateUserRolesPersistsEveryAssignedRole() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(buyerUserMapper.existsByTenantAndId("tenant-1", "user-1")).thenReturn(true);
    when(buyerUserMapper.existsBuyerRoleByTenantAndId("tenant-1", "role-a")).thenReturn(true);
    when(buyerUserMapper.existsBuyerRoleByTenantAndId("tenant-1", "role-b")).thenReturn(true);
    when(buyerUserMapper.findByTenantAndId("tenant-1", "user-1")).thenReturn(new BuyerUser(
        "user-1", "tenant-1", "多角色人员", null, null, "active", "dept-it", "role-a",
        "LDU200001", "审核人"));
    when(buyerUserMapper.listBuyerRoleIdsByTenantAndUser("tenant-1", "user-1"))
        .thenReturn(java.util.List.of("role-a", "role-b"));

    var response = buyerUserApplicationService.updateUserRoles(
        "user-1", new UpdateBuyerUserRolesRequest(java.util.List.of("role-a", "role-b", "role-a")));

    assertThat(response.roleIds()).containsExactly("role-a", "role-b");
    verify(buyerUserMapper).deleteBuyerRoles("tenant-1", "user-1");
    verify(buyerUserMapper).assignRoles("user-1", java.util.List.of("role-a", "role-b"));
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
