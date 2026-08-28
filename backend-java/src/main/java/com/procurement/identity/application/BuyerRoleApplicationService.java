package com.procurement.identity.application;

import com.procurement.common.event.DomainAuditEvent;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.api.BuyerRoleResponse;
import com.procurement.identity.api.CreateBuyerRoleRequest;
import com.procurement.identity.api.MyPermissionsResponse;
import com.procurement.identity.api.PermissionPointResponse;
import com.procurement.identity.api.UpdateBuyerRoleRequest;
import com.procurement.identity.api.UpdateRoleDataScopeRequest;
import com.procurement.identity.api.UpdateRolePermissionsRequest;
import com.procurement.identity.domain.BuyerPermissionCatalog;
import com.procurement.identity.domain.BuyerRole;
import com.procurement.identity.domain.DataScope;
import com.procurement.identity.infrastructure.BuyerRoleMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BuyerRoleApplicationService {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final TypeReference<List<String>> PERMISSIONS_TYPE = new TypeReference<>() {};

  private final BuyerRoleMapper buyerRoleMapper;
  private final PermissionService permissionService;
  private final ApplicationEventPublisher eventPublisher;

  public BuyerRoleApplicationService(
      BuyerRoleMapper buyerRoleMapper,
      PermissionService permissionService,
      ApplicationEventPublisher eventPublisher) {
    this.buyerRoleMapper = buyerRoleMapper;
    this.permissionService = permissionService;
    this.eventPublisher = eventPublisher;
  }

  public List<BuyerRoleResponse> listCurrentTenantRoles() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer role APIs");
    return buyerRoleMapper.listBuyerRolesByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public BuyerRoleResponse createRole(CreateBuyerRoleRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer role APIs");
    permissionService.require("buyer:role:manage");
    String name = request.name().trim();
    requireRoleNameAvailable(tenantId, name, null);
    List<String> permissions = normalizeAndValidatePermissions(request.permissions());
    requireValidDataScope(request.dataScope());
    String roleId = "role-custom-" + UUID.randomUUID();
    buyerRoleMapper.insertBuyerRole(roleId, tenantId, name, writePermissions(permissions), request.dataScope());
    eventPublisher.publishEvent(
        new DomainAuditEvent("buyer_role.created", "buyer_role", roleId, "新建角色: " + name));
    return toResponse(buyerRoleMapper.findBuyerRoleByTenantAndId(tenantId, roleId));
  }

  @Transactional
  public BuyerRoleResponse updateRole(String roleId, UpdateBuyerRoleRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer role APIs");
    permissionService.require("buyer:role:manage");
    BuyerRole current = requireBuyerRole(tenantId, roleId);
    requireMutableRole(current);
    String name = request.name().trim();
    requireRoleNameAvailable(tenantId, name, roleId);
    List<String> permissions = normalizeAndValidatePermissions(request.permissions());
    requireValidDataScope(request.dataScope());
    buyerRoleMapper.updateDetails(tenantId, roleId, name, writePermissions(permissions), request.dataScope());
    eventPublisher.publishEvent(
        new DomainAuditEvent("buyer_role.updated", "buyer_role", roleId, "角色资料更新: " + name));
    return toResponse(buyerRoleMapper.findBuyerRoleByTenantAndId(tenantId, roleId));
  }

  @Transactional
  public void deleteRole(String roleId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer role APIs");
    permissionService.require("buyer:role:manage");
    BuyerRole role = requireBuyerRole(tenantId, roleId);
    if (isBuiltInRole(role)) {
      throw new IllegalStateException("系统内置角色不可删除");
    }
    if (buyerRoleMapper.countUsersByTenantAndRoleId(tenantId, roleId) > 0) {
      throw new IllegalStateException("该角色仍有关联成员，请先为成员分配其他角色");
    }
    buyerRoleMapper.deleteBuyerRole(tenantId, roleId);
    eventPublisher.publishEvent(
        new DomainAuditEvent("buyer_role.deleted", "buyer_role", roleId, "删除角色: " + role.name()));
  }

  // 当前登录用户的有效权限点(展平其激活角色)。前端据此做菜单/路由门禁。
  public MyPermissionsResponse myPermissions() {
    TenantAccessGuard.requireTenantId("buyer role APIs");
    return new MyPermissionsResponse(permissionService.currentUserPermissions());
  }

  // 角色权限矩阵的列定义(可分配权限点目录)。
  public List<PermissionPointResponse> permissionCatalog() {
    return BuyerPermissionCatalog.POINTS.stream()
        .map(p -> new PermissionPointResponse(p.point(), p.label(), p.group()))
        .toList();
  }

  // 更新某角色权限(整组覆盖)。需「管理角色与权限」;仅接受目录内权限点;审计走领域事件。
  @Transactional
  public BuyerRoleResponse updateRolePermissions(String roleId, UpdateRolePermissionsRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer role APIs");
    permissionService.require("buyer:role:manage");
    BuyerRole role = requireBuyerRole(tenantId, roleId);
    requireMutableRole(role);
    List<String> submitted = normalizeAndValidatePermissions(request.permissions());
    // 保留该角色目录之外的既有权限点(矩阵只管理目录内的点),避免整组覆盖时丢失。
    List<String> preserved = parsePermissions(role.permissionsJson()).stream()
        .filter(p -> !BuyerPermissionCatalog.isValid(p))
        .toList();
    List<String> merged =
        java.util.stream.Stream.concat(preserved.stream(), submitted.stream()).distinct().toList();
    buyerRoleMapper.updatePermissions(tenantId, roleId, writePermissions(merged));
    eventPublisher.publishEvent(
        new DomainAuditEvent("buyer_role.permissions_updated", "buyer_role", roleId));
    return toResponse(buyerRoleMapper.findBuyerRoleByTenantAndId(tenantId, roleId));
  }

  // 设置角色数据范围(行级权限)。需「管理角色与权限」;审计走领域事件并带「从→到」明细。
  @Transactional
  public BuyerRoleResponse updateRoleDataScope(String roleId, UpdateRoleDataScopeRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer role APIs");
    permissionService.require("buyer:role:manage");
    requireValidDataScope(request.dataScope());
    BuyerRole role = requireBuyerRole(tenantId, roleId);
    requireMutableRole(role);
    String detail =
        "数据范围: " + dataScopeLabel(role.dataScope()) + " → " + dataScopeLabel(request.dataScope());
    buyerRoleMapper.updateDataScope(tenantId, roleId, request.dataScope());
    eventPublisher.publishEvent(
        new DomainAuditEvent("buyer_role.data_scope_updated", "buyer_role", roleId, detail));
    return toResponse(buyerRoleMapper.findBuyerRoleByTenantAndId(tenantId, roleId));
  }

  private String dataScopeLabel(String dataScope) {
    return switch (dataScope == null ? "" : dataScope) {
      case DataScope.DEPARTMENT -> "仅本部门";
      case DataScope.DEPARTMENT_AND_BELOW -> "本部门及下级";
      case DataScope.SELF -> "仅本人";
      default -> "全部数据";
    };
  }

  private String writePermissions(List<String> permissions) {
    try {
      return OBJECT_MAPPER.writeValueAsString(permissions);
    } catch (Exception exception) {
      throw new IllegalStateException("Cannot serialize role permissions", exception);
    }
  }

  private BuyerRoleResponse toResponse(BuyerRole role) {
    return new BuyerRoleResponse(
        role.id(),
        role.tenantId(),
        role.name(),
        parsePermissions(role.permissionsJson()),
        role.dataScope(),
        isBuiltInRole(role));
  }

  private BuyerRole requireBuyerRole(String tenantId, String roleId) {
    BuyerRole role = buyerRoleMapper.findBuyerRoleByTenantAndId(tenantId, roleId);
    if (role == null) {
      throw new IllegalArgumentException("角色不存在: " + roleId);
    }
    return role;
  }

  private void requireRoleNameAvailable(String tenantId, String name, String excludeRoleId) {
    if (buyerRoleMapper.existsBuyerRoleByTenantAndName(tenantId, name, excludeRoleId)) {
      throw new IllegalArgumentException("角色名称已存在: " + name);
    }
  }

  private List<String> normalizeAndValidatePermissions(List<String> permissions) {
    List<String> submitted = permissions.stream().distinct().toList();
    submitted.forEach(p -> {
      if (!BuyerPermissionCatalog.isValid(p)) {
        throw new IllegalArgumentException("非法权限点: " + p);
      }
    });
    return submitted;
  }

  private void requireValidDataScope(String dataScope) {
    if (!DataScope.isValid(dataScope)) {
      throw new IllegalArgumentException("非法数据范围: " + dataScope);
    }
  }

  private void requireMutableRole(BuyerRole role) {
    if ("role-buyer-owner".equals(role.id())) {
      throw new IllegalStateException("采购管理员是系统保护角色，不可修改权限或数据范围");
    }
  }

  private boolean isBuiltInRole(BuyerRole role) {
    return role.id() != null && role.id().startsWith("role-buyer-");
  }

  private List<String> parsePermissions(String permissionsJson) {
    try {
      return OBJECT_MAPPER.readValue(permissionsJson, PERMISSIONS_TYPE);
    } catch (Exception exception) {
      throw new IllegalStateException("Invalid buyer role permissions JSON: " + permissionsJson, exception);
    }
  }
}
