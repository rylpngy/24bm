package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.BuyerRoleApplicationService;
import com.procurement.identity.domain.BuyerRole;
import com.procurement.identity.infrastructure.BuyerRoleMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class BuyerRoleListingTests {

  private final BuyerRoleMapper buyerRoleMapper = org.mockito.Mockito.mock(BuyerRoleMapper.class);
  private final BuyerRoleApplicationService buyerRoleApplicationService =
      new BuyerRoleApplicationService(buyerRoleMapper);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listCurrentTenantRolesOnlyReadsBuyerRolesInTenantScope() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(buyerRoleMapper.listBuyerRolesByTenant("tenant-1")).thenReturn(List.of(
        new BuyerRole(
            "role-buyer-requester",
            "tenant-1",
            "需求申请人",
            List.of("buyer:demand:create", "buyer:demand:read"))));

    var roles = buyerRoleApplicationService.listCurrentTenantRoles();

    assertThat(roles).hasSize(1);
    assertThat(roles.getFirst().id()).isEqualTo("role-buyer-requester");
    assertThat(roles.getFirst().permissions()).containsExactly("buyer:demand:create", "buyer:demand:read");
    verify(buyerRoleMapper).listBuyerRolesByTenant("tenant-1");
  }
}
