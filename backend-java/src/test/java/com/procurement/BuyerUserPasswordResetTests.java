package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.api.ResetBuyerUserPasswordRequest;
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

class BuyerUserPasswordResetTests {

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
  void resetPasswordRejectsUserOutsideCurrentTenantBeforeHashing() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(buyerUserMapper.existsByTenantAndId("tenant-1", "user-other")).thenReturn(false);

    assertThatThrownBy(() -> buyerUserApplicationService.resetUserPassword(
        "user-other",
        new ResetBuyerUserPasswordRequest("new-password")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Buyer user not found in tenant scope: user-other");

    verify(passwordEncoder, never()).encode(org.mockito.ArgumentMatchers.anyString());
    verify(buyerUserMapper, never()).updatePasswordHash(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void resetPasswordHashesNewPasswordForCurrentTenantUserAndRecordsAuditLog() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(buyerUserMapper.existsByTenantAndId("tenant-1", "user-1")).thenReturn(true);
    when(passwordEncoder.encode("new-password")).thenReturn("{bcrypt}reset-hash");
    when(buyerUserMapper.findByTenantAndId("tenant-1", "user-1")).thenReturn(new BuyerUser(
        "user-1",
        "tenant-1",
        "采购员",
        "13900000001",
        "buyer@example.com",
        "active",
        "dept-it",
        "role-buyer-requester"));

    var response = buyerUserApplicationService.resetUserPassword(
        "user-1",
        new ResetBuyerUserPasswordRequest("new-password"));

    assertThat(response.id()).isEqualTo("user-1");
    verify(buyerUserMapper).updatePasswordHash("tenant-1", "user-1", "{bcrypt}reset-hash");
    verify(auditLogApplicationService).recordTenantAction(
        "buyer_user.password_reset",
        "buyer_user",
        "user-1");
  }
}
