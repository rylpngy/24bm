package com.procurement.identity.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.api.BuyerUserResponse;
import com.procurement.identity.api.CreateBuyerUserRequest;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.tenant.application.TenantEntitlementApplicationService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BuyerUserApplicationService {
  private final BuyerUserMapper buyerUserMapper;
  private final TenantEntitlementApplicationService tenantEntitlementApplicationService;

  public BuyerUserApplicationService(
      BuyerUserMapper buyerUserMapper,
      TenantEntitlementApplicationService tenantEntitlementApplicationService) {
    this.buyerUserMapper = buyerUserMapper;
    this.tenantEntitlementApplicationService = tenantEntitlementApplicationService;
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
    String userId = "user-" + UUID.randomUUID();
    buyerUserMapper.insert(userId, tenantId, request.name(), request.mobile(), request.email(), request.status());
    return toResponse(buyerUserMapper.findByTenantAndId(tenantId, userId));
  }

  private BuyerUserResponse toResponse(BuyerUser user) {
    return new BuyerUserResponse(
        user.id(),
        user.tenantId(),
        user.name(),
        user.mobile(),
        user.email(),
        user.status());
  }
}
