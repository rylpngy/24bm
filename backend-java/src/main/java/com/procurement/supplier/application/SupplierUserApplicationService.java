package com.procurement.supplier.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.api.ChangeSupplierUserStatusRequest;
import com.procurement.supplier.api.ChangeSupplierUserRoleRequest;
import com.procurement.supplier.api.CreateSupplierUserRequest;
import com.procurement.supplier.api.ResetSupplierUserPasswordRequest;
import com.procurement.supplier.api.SupplierUserResponse;
import com.procurement.supplier.api.UpdateSupplierUserRequest;
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
    supplierUserMapper.lockSupplier(supplierId);
    permissions.require("supplier:*");
    String mobile = normalized(request.mobile());
    String email = normalizedEmail(request.email());
    validateContacts(supplierId, "", mobile, email);
    String supplierRoleId = requireDefaultSupplierRoleId(supplierId);
    String userId = "user-" + UUID.randomUUID();
    supplierUserMapper.insert(
        userId,
        supplierId,
        request.name().trim(),
        mobile,
        email,
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

  @Transactional
  public SupplierUserResponse changeUserRole(String userId, ChangeSupplierUserRoleRequest request) {
    permissions.require("supplier:*");
    String supplierId = TenantAccessGuard.requireSupplierId("supplier user APIs");
    supplierUserMapper.lockSupplier(supplierId);
    permissions.require("supplier:*");
    requireSupplierUser(supplierId, userId);
    String roleId = request.roleId();
    boolean owner = "role-system-supplier-owner".equals(roleId);
    if ((!owner && !"role-system-supplier-member".equals(roleId))
        || !supplierUserMapper.existsSupplierRole(supplierId, roleId)) {
      throw new IllegalArgumentException("只能分配供应商管理员或业务成员角色。");
    }
    if (userId.equals(TenantAccessGuard.requireUserId("supplier user APIs"))) {
      throw new IllegalArgumentException("不能修改当前登录账号的角色，请由其他管理员处理。");
    }
    if (!owner && supplierUserMapper.countOtherActiveAdmins(supplierId, userId) == 0) {
      throw new IllegalArgumentException("供应商企业必须保留至少一名启用的管理员。");
    }
    // Replace the complete role set so legacy grants cannot retain administrator access.
    supplierUserMapper.clearUserRoles(supplierId, userId);
    supplierUserMapper.assignRole(userId, roleId);
    supplierUserMapper.invalidateSessions(supplierId, userId);
    auditLogApplicationService.recordTenantAction(
        null, "supplier_user.role_changed:" + roleId, AuditTargetType.SUPPLIER_USER, userId);
    return toResponse(supplierUserMapper.findBySupplierAndId(supplierId, userId));
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  @Transactional
  public SupplierUserResponse updateUserProfile(String userId, UpdateSupplierUserRequest request) {
    permissions.require("supplier:*");
    String supplierId = TenantAccessGuard.requireSupplierId("supplier user APIs");
    supplierUserMapper.lockSupplier(supplierId);
    permissions.require("supplier:*");
    requireSupplierUser(supplierId, userId);
    String mobile = normalized(request.mobile());
    String email = normalizedEmail(request.email());
    validateContacts(supplierId, userId, mobile, email);
    supplierUserMapper.updateProfile(supplierId, userId, request.name().trim(), mobile, email);
    auditLogApplicationService.recordTenantAction(null, "supplier_user.profile_updated", AuditTargetType.SUPPLIER_USER, userId);
    return toResponse(supplierUserMapper.findBySupplierAndId(supplierId, userId));
  }

  private String normalized(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private String normalizedEmail(String value) {
    String email = normalized(value);
    return email == null ? null : email.toLowerCase(java.util.Locale.ROOT);
  }

  private void validateContacts(String supplierId, String userId, String mobile, String email) {
    if (mobile == null && email == null) {
      throw new IllegalArgumentException("手机号或邮箱至少填写一项，用于登录。");
    }
    if (mobile != null && !mobile.matches("\\+?[0-9]{7,20}")) {
      throw new IllegalArgumentException("手机号格式不正确，请填写7至20位数字，可带国际区号加号。");
    }
    if (supplierUserMapper.hasLoginConflict(supplierId, userId, mobile, email)) {
      throw new IllegalArgumentException("手机号或邮箱已被本企业其他账号占用（含停用账号），请更换或联系管理员。");
    }
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
