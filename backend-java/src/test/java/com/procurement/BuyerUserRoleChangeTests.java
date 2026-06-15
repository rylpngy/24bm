package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.api.ChangeBuyerUserRoleRequest;
import com.procurement.identity.application.BuyerUserApplicationService;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.tenant.application.TenantEntitlementApplicationService;
import com.procurement.tenant.infrastructure.TenantEntitlementMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class BuyerUserRoleChangeTests {

  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final DepartmentMapper departmentMapper = org.mockito.Mockito.mock(DepartmentMapper.class);
  private final TenantEntitlementMapper tenantEntitlementMapper =
      org.mockito.Mockito.mock(TenantEntitlementMapper.class);
  private final TenantEntitlementApplicationService tenantEntitlementApplicationService =
      new TenantEntitlementApplicationService(tenantEntitlementMapper);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final BuyerUserApplicationService buyerUserApplicationService =
      new BuyerUserApplicationService(
          buyerUserMapper,
          departmentMapper,
          tenantEntitlementApplicationService,
          auditLogApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void changeRoleRejectsUserOutsideCurrentTenantBeforeWritingRelation() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(buyerUserMapper.existsByTenantAndId("tenant-1", "user-other")).thenReturn(false);

    assertThatThrownBy(() -> buyerUserApplicationService.changeUserRole(
        "user-other",
        new ChangeBuyerUserRoleRequest("role-buyer-requester")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Buyer user not found in tenant scope: user-other");

    verify(buyerUserMapper, never()).replaceRole(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void changeRoleReplacesRelationWithCurrentTenantBuyerRole() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(buyerUserMapper.existsByTenantAndId("tenant-1", "user-1")).thenReturn(true);
    when(buyerUserMapper.existsBuyerRoleByTenantAndId("tenant-1", "role-buyer-requester")).thenReturn(true);
    when(buyerUserMapper.findByTenantAndId("tenant-1", "user-1")).thenReturn(new BuyerUser(
        "user-1",
        "tenant-1",
        "采购员",
        "13900000001",
        "buyer@example.com",
        "active",
        "dept-it",
        "role-buyer-requester"));

    var response = buyerUserApplicationService.changeUserRole(
        "user-1",
        new ChangeBuyerUserRoleRequest("role-buyer-requester"));

    assertThat(response.roleId()).isEqualTo("role-buyer-requester");
    verify(buyerUserMapper).replaceRole("tenant-1", "user-1", "role-buyer-requester");
    verify(auditLogApplicationService).recordTenantAction(
        "buyer_user.role_changed",
        "buyer_user",
        "user-1");
  }
}
