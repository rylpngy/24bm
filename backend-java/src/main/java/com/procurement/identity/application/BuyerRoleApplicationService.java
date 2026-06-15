package com.procurement.identity.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.api.BuyerRoleResponse;
import com.procurement.identity.domain.BuyerRole;
import com.procurement.identity.infrastructure.BuyerRoleMapper;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class BuyerRoleApplicationService {
  private final BuyerRoleMapper buyerRoleMapper;

  public BuyerRoleApplicationService(BuyerRoleMapper buyerRoleMapper) {
    this.buyerRoleMapper = buyerRoleMapper;
  }

  public List<BuyerRoleResponse> listCurrentTenantRoles() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer role APIs");
    return buyerRoleMapper.listBuyerRolesByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
  }

  private BuyerRoleResponse toResponse(BuyerRole role) {
    return new BuyerRoleResponse(
        role.id(),
        role.tenantId(),
        role.name(),
        role.permissions());
  }
}
