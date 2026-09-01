package com.procurement.identity.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.api.BuyerUserResponse;
import com.procurement.identity.api.ChangeBuyerUserRoleRequest;
import com.procurement.identity.api.ChangeBuyerUserStatusRequest;
import com.procurement.identity.api.CreateBuyerUserRequest;
import com.procurement.identity.api.ResetBuyerUserPasswordRequest;
import com.procurement.identity.api.UpdateBuyerUserRequest;
import com.procurement.identity.api.UpdateBuyerUserRolesRequest;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.domain.BuyerUserAuditAction;
import com.procurement.identity.domain.BuyerUserStatusTransition;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.tenant.application.TenantEntitlementApplicationService;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BuyerUserApplicationService {
  private final BuyerUserMapper buyerUserMapper;
  private final DepartmentMapper departmentMapper;
  private final TenantEntitlementApplicationService tenantEntitlementApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final PasswordEncoder passwordEncoder;
  private final BuyerUserStatusTransition buyerUserStatusTransition;
  private final PermissionService permissionService;

  public BuyerUserApplicationService(
      BuyerUserMapper buyerUserMapper,
      DepartmentMapper departmentMapper,
      TenantEntitlementApplicationService tenantEntitlementApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      PasswordEncoder passwordEncoder,
      BuyerUserStatusTransition buyerUserStatusTransition,
      PermissionService permissionService) {
    this.buyerUserMapper = buyerUserMapper;
    this.departmentMapper = departmentMapper;
    this.tenantEntitlementApplicationService = tenantEntitlementApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.passwordEncoder = passwordEncoder;
    this.buyerUserStatusTransition = buyerUserStatusTransition;
    this.permissionService = permissionService;
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
    requireTeamManagement();
    tenantEntitlementApplicationService.requireUserCapacity(tenantId, buyerUserMapper.countByTenant(tenantId));
    requireActiveDepartment(tenantId, request.departmentId());
    requireBuyerRole(tenantId, request.roleId());
    String employeeNo = normalizeEmployeeNo(request.employeeNo());
    requireUniqueEmployeeNo(tenantId, employeeNo, null);
    String userId = "user-" + UUID.randomUUID();
    buyerUserMapper.insert(
        userId,
        tenantId,
        request.name(),
        request.mobile(),
        request.email(),
        request.status(),
        request.departmentId(),
        passwordEncoder.encode(request.initialPassword()),
        employeeNo,
        request.jobTitle() == null ? "" : request.jobTitle());
    buyerUserMapper.assignRole(userId, request.roleId());
    auditLogApplicationService.recordTenantAction(BuyerUserAuditAction.CREATED, AuditTargetType.BUYER_USER, userId);
    return toResponse(buyerUserMapper.findByTenantAndId(tenantId, userId));
  }

  /**
   * 维护成员资料、所属部门和主角色。
   *
   * <p>调出一名部门负责人时会自动解除其原部门负责人身份，避免流程审批继续指向已调岗人员。</p>
   */
  @Transactional
  public BuyerUserResponse updateUser(String userId, UpdateBuyerUserRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer user APIs");
    requireTeamManagement();
    requireBuyerUser(tenantId, userId);
    requireActiveDepartment(tenantId, request.departmentId());
    requireBuyerRole(tenantId, request.roleId());

    BuyerUser current = buyerUserMapper.findByTenantAndId(tenantId, userId);
    String name = request.name().trim();
    String mobile = blankToNull(request.mobile());
    String email = blankToNull(request.email());
    String employeeNo = normalizeEmployeeNo(request.employeeNo());
    requireUniqueEmployeeNo(tenantId, employeeNo, userId);
    String jobTitle = blankToNull(request.jobTitle());
    boolean departmentChanged = !Objects.equals(current.departmentId(), request.departmentId());
    boolean roleChanged = !Objects.equals(current.roleId(), request.roleId());

    buyerUserMapper.updateDetails(
        tenantId,
        userId,
        name,
        mobile,
        email,
        request.departmentId(),
        employeeNo,
        jobTitle);
    if (roleChanged) {
      buyerUserMapper.replaceRole(tenantId, userId, request.roleId());
    }
    if (departmentChanged) {
      departmentMapper.clearManagerByUserIdExceptDepartment(tenantId, userId, request.departmentId());
    }

    auditLogApplicationService.recordTenantAction(
        tenantId,
        BuyerUserAuditAction.UPDATED,
        AuditTargetType.BUYER_USER,
        userId,
        updateDetail(current, name, request.departmentId(), request.roleId()));
    return toResponse(buyerUserMapper.findByTenantAndId(tenantId, userId));
  }

  @Transactional
  public BuyerUserResponse resetUserPassword(String userId, ResetBuyerUserPasswordRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer user APIs");
    requireTeamManagement();
    requireBuyerUser(tenantId, userId);
    buyerUserMapper.updatePasswordHash(tenantId, userId, passwordEncoder.encode(request.newPassword()));
    auditLogApplicationService.recordTenantAction(BuyerUserAuditAction.PASSWORD_RESET, AuditTargetType.BUYER_USER, userId);
    return toResponse(buyerUserMapper.findByTenantAndId(tenantId, userId));
  }

  @Transactional
  public BuyerUserResponse changeUserRole(String userId, ChangeBuyerUserRoleRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer user APIs");
    requireTeamManagement();
    requireBuyerUser(tenantId, userId);
    requireBuyerRole(tenantId, request.roleId());
    BuyerUser current = buyerUserMapper.findByTenantAndId(tenantId, userId);
    String detail = "角色: " + roleLabel(tenantId, current.roleId()) + " → " + roleLabel(tenantId, request.roleId());
    buyerUserMapper.replaceRole(tenantId, userId, request.roleId());
    auditLogApplicationService.recordTenantAction(
        tenantId, BuyerUserAuditAction.ROLE_CHANGED, AuditTargetType.BUYER_USER, userId, detail);
    return toResponse(buyerUserMapper.findByTenantAndId(tenantId, userId));
  }

  @Transactional
  public BuyerUserResponse updateUserRoles(String userId, UpdateBuyerUserRolesRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer user APIs");
    requireTeamManagement();
    requireBuyerUser(tenantId, userId);
    List<String> roleIds = request.roleIds().stream().distinct().toList();
    roleIds.forEach(roleId -> requireBuyerRole(tenantId, roleId));
    buyerUserMapper.deleteBuyerRoles(tenantId, userId);
    buyerUserMapper.assignRoles(userId, roleIds);
    auditLogApplicationService.recordTenantAction(
        tenantId,
        BuyerUserAuditAction.ROLE_CHANGED,
        AuditTargetType.BUYER_USER,
        userId,
        "角色调整为: " + roleIds.stream().map(roleId -> roleLabel(tenantId, roleId)).toList());
    return toResponse(buyerUserMapper.findByTenantAndId(tenantId, userId));
  }

  @Transactional
  public BuyerUserResponse changeUserStatus(String userId, ChangeBuyerUserStatusRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer user APIs");
    requireTeamManagement();
    requireBuyerUser(tenantId, userId);
    buyerUserStatusTransition.requireSupportedTarget(request.status());
    BuyerUser current = buyerUserMapper.findByTenantAndId(tenantId, userId);
    String detail = "状态: " + current.status() + " → " + request.status();
    buyerUserMapper.updateStatus(tenantId, userId, request.status());
    if ("inactive".equals(request.status())) {
      departmentMapper.clearManagerByUserId(tenantId, userId);
    }
    auditLogApplicationService.recordTenantAction(
        tenantId, BuyerUserAuditAction.STATUS_CHANGED, AuditTargetType.BUYER_USER, userId, detail);
    return toResponse(buyerUserMapper.findByTenantAndId(tenantId, userId));
  }

  // 角色 id → 名称(便于审计可读);名称缺失时回落到 id。
  private String roleLabel(String tenantId, String roleId) {
    String name = buyerUserMapper.findBuyerRoleNameByTenantAndId(tenantId, roleId);
    return name == null || name.isBlank() ? roleId : name;
  }

  private String updateDetail(BuyerUser current, String name, String departmentId, String roleId) {
    java.util.List<String> changes = new java.util.ArrayList<>();
    if (!Objects.equals(current.name(), name)) {
      changes.add("姓名: " + current.name() + " → " + name);
    }
    if (!Objects.equals(current.departmentId(), departmentId)) {
      changes.add("部门: " + current.departmentId() + " → " + departmentId);
    }
    if (!Objects.equals(current.roleId(), roleId)) {
      changes.add("角色: " + roleLabel(current.tenantId(), current.roleId()) + " → "
          + roleLabel(current.tenantId(), roleId));
    }
    return changes.isEmpty() ? "成员资料更新" : String.join("；", changes);
  }

  private void requireTeamManagement() {
    permissionService.require("buyer:role:manage");
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
        user.roleId(),
        user.employeeNo(),
        user.jobTitle(),
        buyerUserMapper.listBuyerRoleIdsByTenantAndUser(user.tenantId(), user.id()));
  }

  private void requireUniqueEmployeeNo(String tenantId, String employeeNo, String excludedUserId) {
    if (employeeNo != null
        && buyerUserMapper.existsByEmployeeNoExcludingUser(tenantId, employeeNo, excludedUserId)) {
      throw new IllegalArgumentException("工号已存在于当前企业，请检查后重试");
    }
  }

  private String normalizeEmployeeNo(String value) {
    String employeeNo = blankToNull(value);
    return employeeNo == null ? null : employeeNo.toUpperCase(java.util.Locale.ROOT);
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
