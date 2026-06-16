package com.procurement.identity.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.api.BuyerUserResponse;
import com.procurement.identity.api.ChangeBuyerUserRoleRequest;
import com.procurement.identity.api.ChangeBuyerUserStatusRequest;
import com.procurement.identity.api.CreateBuyerUserRequest;
import com.procurement.identity.api.ResetBuyerUserPasswordRequest;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.domain.BuyerUserAuditAction;
import com.procurement.identity.domain.BuyerUserStatusTransition;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.tenant.application.TenantEntitlementApplicationService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BuyerUserApplicationService {
  private static final String BUYER_USER_TARGET_TYPE = "buyer_user";

  private final BuyerUserMapper buyerUserMapper;
  private final DepartmentMapper departmentMapper;
  private final TenantEntitlementApplicationService tenantEntitlementApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final PasswordEncoder passwordEncoder;
  private final BuyerUserStatusTransition buyerUserStatusTransition;

  public BuyerUserApplicationService(
      BuyerUserMapper buyerUserMapper,
      DepartmentMapper departmentMapper,
      TenantEntitlementApplicationService tenantEntitlementApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      PasswordEncoder passwordEncoder,
      BuyerUserStatusTransition buyerUserStatusTransition) {
    this.buyerUserMapper = buyerUserMapper;
    this.departmentMapper = departmentMapper;
    this.tenantEntitlementApplicationService = tenantEntitlementApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.passwordEncoder = passwordEncoder;
    this.buyerUserStatusTransition = buyerUserStatusTransition;
  }

  public List<BuyerUserResponse> listCurrentTenantUsers() {
    return listCurrentTenantUsers(null, null, null);
  }

  public List<BuyerUserResponse> listCurrentTenantUsers(String status, String departmentId, String keyword) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer user APIs");
    return buyerUserMapper.listByTenantFiltered(
            tenantId,
            blankToNull(status),
            blankToNull(departmentId),
            blankToNull(keyword))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public BuyerUserResponse createUser(CreateBuyerUserRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer user APIs");
    tenantEntitlementApplicationService.requireUserCapacity(tenantId, buyerUserMapper.countByTenant(tenantId));
    requireActiveDepartment(tenantId, request.departmentId());
    requireBuyerRole(tenantId, request.roleId());
    String userId = "user-" + UUID.randomUUID();
    buyerUserMapper.insert(
        userId,
        tenantId,
        request.name(),
        request.mobile(),
        request.email(),
        request.status(),
        request.departmentId(),
        passwordEncoder.encode(request.initialPassword()));
    buyerUserMapper.assignRole(userId, request.roleId());
    auditLogApplicationService.recordTenantAction(BuyerUserAuditAction.CREATED, BUYER_USER_TARGET_TYPE, userId);
    return toResponse(buyerUserMapper.findByTenantAndId(tenantId, userId));
  }

  @Transactional
  public BuyerUserResponse resetUserPassword(String userId, ResetBuyerUserPasswordRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer user APIs");
    requireBuyerUser(tenantId, userId);
    buyerUserMapper.updatePasswordHash(tenantId, userId, passwordEncoder.encode(request.newPassword()));
    auditLogApplicationService.recordTenantAction(BuyerUserAuditAction.PASSWORD_RESET, BUYER_USER_TARGET_TYPE, userId);
    return toResponse(buyerUserMapper.findByTenantAndId(tenantId, userId));
  }

  @Transactional
  public BuyerUserResponse changeUserRole(String userId, ChangeBuyerUserRoleRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer user APIs");
    requireBuyerUser(tenantId, userId);
    requireBuyerRole(tenantId, request.roleId());
    buyerUserMapper.replaceRole(tenantId, userId, request.roleId());
    auditLogApplicationService.recordTenantAction(BuyerUserAuditAction.ROLE_CHANGED, BUYER_USER_TARGET_TYPE, userId);
    return toResponse(buyerUserMapper.findByTenantAndId(tenantId, userId));
  }

  @Transactional
  public BuyerUserResponse changeUserStatus(String userId, ChangeBuyerUserStatusRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer user APIs");
    requireBuyerUser(tenantId, userId);
    buyerUserStatusTransition.requireSupportedTarget(request.status());
    buyerUserMapper.updateStatus(tenantId, userId, request.status());
    auditLogApplicationService.recordTenantAction(BuyerUserAuditAction.STATUS_CHANGED, BUYER_USER_TARGET_TYPE, userId);
    return toResponse(buyerUserMapper.findByTenantAndId(tenantId, userId));
  }

  private void requireActiveDepartment(String tenantId, String departmentId) {
    if (!departmentMapper.existsActiveByTenantAndId(tenantId, departmentId)) {
      throw new IllegalArgumentException("Department not found in tenant scope: " + departmentId);
    }
  }

  private void requireBuyerRole(String tenantId, String roleId) {
    if (!buyerUserMapper.existsBuyerRoleByTenantAndId(tenantId, roleId)) {
      throw new IllegalArgumentException("Buyer role not found in tenant scope: " + roleId);
    }
  }

  private void requireBuyerUser(String tenantId, String userId) {
    if (!buyerUserMapper.existsByTenantAndId(tenantId, userId)) {
      throw new IllegalArgumentException("Buyer user not found in tenant scope: " + userId);
    }
  }

  private BuyerUserResponse toResponse(BuyerUser user) {
    return new BuyerUserResponse(
        user.id(),
        user.tenantId(),
        user.name(),
        user.mobile(),
        user.email(),
        user.status(),
        user.departmentId(),
        user.roleId());
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
