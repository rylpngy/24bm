package com.procurement.supplier.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.supplier.api.CreateSupplierUserRequest;
import com.procurement.supplier.api.SupplierUserResponse;
import com.procurement.supplier.domain.SupplierUser;
import com.procurement.supplier.infrastructure.SupplierUserMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupplierUserApplicationService {
  private static final String ACTIVE_STATUS = "active";
  private static final String INACTIVE_STATUS = "inactive";
  private static final String SUPPLIER_USER_CREATED_ACTION = "supplier_user.created";
  private static final String SUPPLIER_USER_TARGET_TYPE = "supplier_user";

  private final SupplierUserMapper supplierUserMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final PasswordEncoder passwordEncoder;

  public SupplierUserApplicationService(
      SupplierUserMapper supplierUserMapper,
      AuditLogApplicationService auditLogApplicationService,
      PasswordEncoder passwordEncoder) {
    this.supplierUserMapper = supplierUserMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.passwordEncoder = passwordEncoder;
  }

  public List<SupplierUserResponse> listCurrentSupplierUsers() {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier user APIs");
    return supplierUserMapper.listBySupplier(supplierId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public SupplierUserResponse createCurrentSupplierUser(CreateSupplierUserRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier user APIs");
    requireSupportedStatus(request.status());
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
        SUPPLIER_USER_CREATED_ACTION,
        SUPPLIER_USER_TARGET_TYPE,
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

  private void requireSupportedStatus(String status) {
    if (!ACTIVE_STATUS.equals(status) && !INACTIVE_STATUS.equals(status)) {
      throw new IllegalArgumentException("Unsupported supplier user status: " + status);
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
