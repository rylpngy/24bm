package com.procurement.identity.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.api.BuyerUserResponse;
import com.procurement.identity.api.CreateBuyerUserRequest;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.tenant.application.TenantEntitlementApplicationService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BuyerUserApplicationService {
  private static final String BUYER_USER_CREATED_ACTION = "buyer_user.created";
  private static final String BUYER_USER_TARGET_TYPE = "buyer_user";

  private final BuyerUserMapper buyerUserMapper;
  private final DepartmentMapper departmentMapper;
  private final TenantEntitlementApplicationService tenantEntitlementApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;

  public BuyerUserApplicationService(
      BuyerUserMapper buyerUserMapper,
      DepartmentMapper departmentMapper,
      TenantEntitlementApplicationService tenantEntitlementApplicationService,
      AuditLogApplicationService auditLogApplicationService) {
    this.buyerUserMapper = buyerUserMapper;
    this.departmentMapper = departmentMapper;
    this.tenantEntitlementApplicationService = tenantEntitlementApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  public List<BuyerUserResponse> listCurrentTenantUsers() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer user APIs");
    return buyerUserMapper.listByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public BuyerUserResponse createUser(CreateBuyerUserRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer user APIs");
    tenantEntitlementApplicationService.requireUserCapacity(tenantId, buyerUserMapper.countByTenant(tenantId));
    requireActiveDepartment(tenantId, request.departmentId());
    String userId = "user-" + UUID.randomUUID();
    buyerUserMapper.insert(
        userId,
        tenantId,
        request.name(),
        request.mobile(),
        request.email(),
        request.status(),
        request.departmentId());
    auditLogApplicationService.recordTenantAction(BUYER_USER_CREATED_ACTION, BUYER_USER_TARGET_TYPE, userId);
    return toResponse(buyerUserMapper.findByTenantAndId(tenantId, userId));
  }

  private void requireActiveDepartment(String tenantId, String departmentId) {
    if (!departmentMapper.existsActiveByTenantAndId(tenantId, departmentId)) {
      throw new IllegalArgumentException("Department not found in tenant scope: " + departmentId);
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
        user.departmentId());
  }
}
