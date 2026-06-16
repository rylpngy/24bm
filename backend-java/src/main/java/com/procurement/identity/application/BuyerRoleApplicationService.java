package com.procurement.identity.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.api.BuyerRoleResponse;
import com.procurement.identity.domain.BuyerRole;
import com.procurement.identity.infrastructure.BuyerRoleMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class BuyerRoleApplicationService {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final TypeReference<List<String>> PERMISSIONS_TYPE = new TypeReference<>() {};

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
        parsePermissions(role.permissionsJson()));
  }

  private List<String> parsePermissions(String permissionsJson) {
    try {
      return OBJECT_MAPPER.readValue(permissionsJson, PERMISSIONS_TYPE);
    } catch (Exception exception) {
      throw new IllegalStateException("Invalid buyer role permissions JSON: " + permissionsJson, exception);
    }
  }
}
