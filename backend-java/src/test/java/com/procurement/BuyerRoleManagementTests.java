package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.event.DomainAuditEvent;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.api.CreateBuyerRoleRequest;
import com.procurement.identity.api.UpdateBuyerRoleRequest;
import com.procurement.identity.application.BuyerRoleApplicationService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.BuyerRole;
import com.procurement.identity.infrastructure.BuyerRoleMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

class BuyerRoleManagementTests {

  private final BuyerRoleMapper buyerRoleMapper = org.mockito.Mockito.mock(BuyerRoleMapper.class);
  private final PermissionService permissionService = org.mockito.Mockito.mock(PermissionService.class);
  private final ApplicationEventPublisher eventPublisher = org.mockito.Mockito.mock(ApplicationEventPublisher.class);
  private final BuyerRoleApplicationService service = new BuyerRoleApplicationService(
      buyerRoleMapper, permissionService, eventPublisher);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void createsCustomRoleWithValidatedPermissionAndScope() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(buyerRoleMapper.existsBuyerRoleByTenantAndName("tenant-1", "采购协同员", null)).thenReturn(false);
    when(buyerRoleMapper.findBuyerRoleByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"), org.mockito.ArgumentMatchers.startsWith("role-custom-")))
        .thenAnswer(invocation -> new BuyerRole(
            invocation.getArgument(1), "tenant-1", "采购协同员", "[\"buyer:demand:read\"]", "department"));

    service.createRole(new CreateBuyerRoleRequest(
        "采购协同员", List.of("buyer:demand:read"), "department"));

    verify(buyerRoleMapper).insertBuyerRole(
        org.mockito.ArgumentMatchers.startsWith("role-custom-"),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("采购协同员"),
        org.mockito.ArgumentMatchers.contains("buyer:demand:read"),
        org.mockito.ArgumentMatchers.eq("department"));
    verify(eventPublisher).publishEvent(org.mockito.ArgumentMatchers.<Object>argThat(event ->
        event instanceof DomainAuditEvent audit && "buyer_role.created".equals(audit.action())));
  }

  @Test
  void updatesCustomRoleAsOneAtomicConfiguration() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    BuyerRole role = new BuyerRole(
        "role-custom-1", "tenant-1", "旧角色", "[]", "all");
    when(buyerRoleMapper.findBuyerRoleByTenantAndId("tenant-1", "role-custom-1")).thenReturn(role);
    when(buyerRoleMapper.existsBuyerRoleByTenantAndName("tenant-1", "新角色", "role-custom-1")).thenReturn(false);

    service.updateRole("role-custom-1", new UpdateBuyerRoleRequest(
        "新角色", List.of("buyer:material:read"), "self"));

    verify(buyerRoleMapper).updateDetails(
        "tenant-1", "role-custom-1", "新角色", "[\"buyer:material:read\"]", "self");
  }

  @Test
  void protectsSystemAdministratorFromConfigurationChanges() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(buyerRoleMapper.findBuyerRoleByTenantAndId("tenant-1", "role-buyer-owner"))
        .thenReturn(new BuyerRole("role-buyer-owner", "tenant-1", "采购管理员", "[\"buyer:*\"]", "all"));

    assertThatThrownBy(() -> service.updateRole("role-buyer-owner", new UpdateBuyerRoleRequest(
        "采购管理员", List.of("buyer:*"), "all")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("系统保护角色");

    verify(buyerRoleMapper, never()).updateDetails(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @org.junit.jupiter.params.ParameterizedTest
  @org.junit.jupiter.params.provider.ValueSource(strings = {"details", "permissions", "scope", "delete"})
  void protectsProvisionedTenantOwnerAtEveryMutationEntry(String action) {
    TenantContext.set("tenant-1", null, "buyer-owner");
    String id = "role-tenant-1-buyer-owner";
    when(buyerRoleMapper.findBuyerRoleByTenantAndId("tenant-1", id))
        .thenReturn(new BuyerRole(id, "tenant-1", "Owner", "[\"buyer:*\"]", "all"));
    assertThatThrownBy(() -> {
      switch (action) {
        case "details" -> service.updateRole(id, new UpdateBuyerRoleRequest("Owner", List.of(), "self"));
        case "permissions" -> service.updateRolePermissions(id,
            new com.procurement.identity.api.UpdateRolePermissionsRequest(List.of()));
        case "scope" -> service.updateRoleDataScope(id,
            new com.procurement.identity.api.UpdateRoleDataScopeRequest("self"));
        default -> service.deleteRole(id);
      }
    }).isInstanceOf(IllegalStateException.class);
  }

  @Test
  void provisionedOwnerResponseIdentifiesBuiltInAndProtectedRole() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(buyerRoleMapper.listBuyerRolesByTenant("tenant-1")).thenReturn(List.of(
        new BuyerRole("role-tenant-1-buyer-owner", "tenant-1", "Owner", "[\"buyer:*\"]", "all")));
    var json = new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(service.listCurrentTenantRoles().getFirst());
    org.assertj.core.api.Assertions.assertThat(json.path("builtIn").asBoolean()).isTrue();
    org.assertj.core.api.Assertions.assertThat(json.path("protectedRole").asBoolean()).isTrue();
  }
}
