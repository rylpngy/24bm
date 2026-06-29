package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.event.DomainAuditEvent;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.api.UpdateRolePermissionsRequest;
import com.procurement.identity.application.BuyerRoleApplicationService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.BuyerRole;
import com.procurement.identity.infrastructure.BuyerRoleMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

class BuyerRoleListingTests {

  private final BuyerRoleMapper buyerRoleMapper = mock(BuyerRoleMapper.class);
  private final PermissionService permissionService = mock(PermissionService.class);
  private final ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
  private final BuyerRoleApplicationService buyerRoleApplicationService =
      new BuyerRoleApplicationService(buyerRoleMapper, permissionService, eventPublisher);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listCurrentTenantRolesOnlyReadsBuyerRolesInTenantScope() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(buyerRoleMapper.listBuyerRolesByTenant("tenant-1")).thenReturn(List.of(
        new BuyerRole(
            "role-buyer-requester",
            "tenant-1",
            "需求申请人",
            "[\"buyer:demand:create\",\"buyer:demand:read\"]")));

    var roles = buyerRoleApplicationService.listCurrentTenantRoles();

    assertThat(roles).hasSize(1);
    assertThat(roles.getFirst().id()).isEqualTo("role-buyer-requester");
    assertThat(roles.getFirst().permissions()).containsExactly("buyer:demand:create", "buyer:demand:read");
    verify(buyerRoleMapper).listBuyerRolesByTenant("tenant-1");
  }

  @Test
  void myPermissionsReturnsFlattenedEffectivePoints() {
    TenantContext.set("tenant-1", null, "buyer-staff");
    when(permissionService.currentUserPermissions())
        .thenReturn(List.of("buyer:demand:read", "buyer:demand:create"));

    var response = buyerRoleApplicationService.myPermissions();

    assertThat(response.permissions()).containsExactly("buyer:demand:read", "buyer:demand:create");
  }

  @Test
  void permissionCatalogExposesAssignablePoints() {
    var catalog = buyerRoleApplicationService.permissionCatalog();
    assertThat(catalog).extracting("point")
        .contains("buyer:*", "buyer:role:manage", "buyer:payment:register", "buyer:report:export");
  }

  @Test
  void updateRolePermissionsPersistsAndAuditsWhenAuthorized() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(buyerRoleMapper.findBuyerRoleByTenantAndId("tenant-1", "role-fin"))
        .thenReturn(new BuyerRole("role-fin", "tenant-1", "财务", "[]"));

    buyerRoleApplicationService.updateRolePermissions(
        "role-fin",
        new UpdateRolePermissionsRequest(List.of("buyer:payment:register", "buyer:report:export")));

    verify(permissionService).require("buyer:role:manage");
    verify(buyerRoleMapper).updatePermissions(
        eq("tenant-1"), eq("role-fin"),
        org.mockito.ArgumentMatchers.contains("buyer:payment:register"));
    verify(eventPublisher).publishEvent(
        org.mockito.ArgumentMatchers.<Object>argThat(ev ->
            ev instanceof DomainAuditEvent e
                && e.action().equals("buyer_role.permissions_updated")
                && e.targetId().equals("role-fin")));
  }

  @Test
  void updateRolePermissionsRejectsPointOutsideCatalog() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(buyerRoleMapper.findBuyerRoleByTenantAndId("tenant-1", "role-fin"))
        .thenReturn(new BuyerRole("role-fin", "tenant-1", "财务", "[]"));

    assertThatThrownBy(() ->
        buyerRoleApplicationService.updateRolePermissions(
            "role-fin", new UpdateRolePermissionsRequest(List.of("buyer:hack:all"))))
        .isInstanceOf(IllegalArgumentException.class);

    verify(buyerRoleMapper, never()).updatePermissions(any(), any(), any());
  }

  @Test
  void updateRolePermissionsRequiresManagePermission() {
    TenantContext.set("tenant-1", null, "buyer-staff");
    doThrow(new PermissionDeniedException("缺少所需权限:buyer:role:manage"))
        .when(permissionService).require("buyer:role:manage");

    assertThatThrownBy(() ->
        buyerRoleApplicationService.updateRolePermissions(
            "role-fin", new UpdateRolePermissionsRequest(List.of("buyer:report:export"))))
        .isInstanceOf(PermissionDeniedException.class);

    verify(buyerRoleMapper, never()).updatePermissions(any(), any(), any());
  }
}
