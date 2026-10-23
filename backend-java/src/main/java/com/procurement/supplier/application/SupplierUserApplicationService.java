package com.procurement.supplier.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.api.ChangeSupplierUserStatusRequest;
import com.procurement.supplier.api.CreateSupplierUserRequest;
import com.procurement.supplier.api.ResetSupplierUserPasswordRequest;
import com.procurement.supplier.api.SupplierUserResponse;
import com.procurement.supplier.domain.SupplierUser;
import com.procurement.supplier.domain.SupplierUserAuditAction;
import com.procurement.supplier.domain.SupplierUserStatusTransition;
import com.procurement.supplier.infrastructure.SupplierUserMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupplierUserApplicationService {
  private final SupplierUserMapper supplierUserMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final PasswordEncoder passwordEncoder;
  private final SupplierUserStatusTransition supplierUserStatusTransition;
  private final PermissionService permissions;

  public SupplierUserApplicationService(
      SupplierUserMapper supplierUserMapper,
      AuditLogApplicationService auditLogApplicationService,
      PasswordEncoder passwordEncoder,
      SupplierUserStatusTransition supplierUserStatusTransition,
      PermissionService permissions) {
    this.supplierUserMapper = supplierUserMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.passwordEncoder = passwordEncoder;
    this.supplierUserStatusTransition = supplierUserStatusTransition;
    this.permissions = permissions;
  }

  public List<SupplierUserResponse> listCurrentSupplierUsers() {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier user APIs");
    return supplierUserMapper.listBySupplier(supplierId).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<SupplierUserResponse> listCurrentSupplierUsers(String status, String keyword) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier user APIs");
    return supplierUserMapper.listBySupplierFiltered(
            supplierId,
            blankToNull(status),
            blankToNull(keyword))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public SupplierUserResponse createCurrentSupplierUser(CreateSupplierUserRequest request) {
    permissions.require("supplier:*");
    String supplierId = TenantAccessGuard.requireSupplierId("supplier user APIs");
    supplierUserStatusTransition.requireSupportedTarget(request.status());
    String supplierRoleId = requireDefaultSupplierRoleId(supplierId);
    String userId = "user-" + UUID.randomUUID();
    supplierUserMapper.insert(
        userId,
        supplierId,
        request.name(),
        request.mobile(),
        request.email(),
        request.status(),
        passwordEncoder.encode(request.initialPassword()));
    supplierUserMapper.assignRole(userId, supplierRoleId);
    auditLogApplicationService.recordTenantAction(
        null,
        SupplierUserAuditAction.CREATED,
        AuditTargetType.SUPPLIER_USER,
        userId);
    return toResponse(supplierUserMapper.findBySupplierAndId(supplierId, userId));
  }

  @Transactional
  public SupplierUserResponse resetUserPassword(String userId, ResetSupplierUserPasswordRequest request) {
    permissions.require("supplier:*");
    String supplierId = TenantAccessGuard.requireSupplierId("supplier user APIs");
    requireSupplierUser(supplierId, userId);
    supplierUserMapper.updatePasswordHash(
        supplierId,
        userId,
        passwordEncoder.encode(request.newPassword()));
    auditLogApplicationService.recordTenantAction(
        null,
        SupplierUserAuditAction.PASSWORD_RESET,
        AuditTargetType.SUPPLIER_USER,
        userId);
    return toResponse(supplierUserMapper.findBySupplierAndId(supplierId, userId));
  }

  @Transactional
  public SupplierUserResponse changeUserStatus(String userId, ChangeSupplierUserStatusRequest request) {
    permissions.require("supplier:*");
    String supplierId = TenantAccessGuard.requireSupplierId("supplier user APIs");
    requireSupplierUser(supplierId, userId);
    supplierUserStatusTransition.requireSupportedTarget(request.status());
    // Serialize status changes within a supplier and recheck the actor after acquiring the lock.
    supplierUserMapper.lockSupplier(supplierId);
    permissions.require("supplier:*");
    if ("inactive".equals(request.status())
        && userId.equals(TenantAccessGuard.requireUserId("supplier user APIs"))) {
      throw new IllegalArgumentException("不能停用当前登录账号，请由其他管理员处理。");
    }
    if ("inactive".equals(request.status()) && supplierUserMapper.countOtherActiveAdmins(supplierId, userId) == 0) {
      throw new IllegalArgumentException("供应商企业必须保留至少一名启用的管理员。");
    }
    supplierUserMapper.updateStatus(supplierId, userId, request.status());
    auditLogApplicationService.recordTenantAction(
        null,
        SupplierUserAuditAction.STATUS_CHANGED,
        AuditTargetType.SUPPLIER_USER,
        userId);
    return toResponse(supplierUserMapper.findBySupplierAndId(supplierId, userId));
  }

  private String requireDefaultSupplierRoleId(String supplierId) {
    String roleId = supplierUserMapper.findDefaultSupplierRoleId(supplierId);
    if (roleId == null || roleId.isBlank()) {
      throw new IllegalStateException("Default supplier role not found.");
    }
    return roleId;
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  private void requireSupplierUser(String supplierId, String userId) {
    if (!supplierUserMapper.existsBySupplierAndId(supplierId, userId)) {
      throw new IllegalArgumentException("Supplier user not found in supplier scope: " + userId);
    }
  }

  private SupplierUserResponse toResponse(SupplierUser user) {
    return new SupplierUserResponse(
        user.id(),
        user.supplierId(),
        user.name(),
        user.mobile(),
        user.email(),
        user.status(),
        user.roleId());
  }
}
