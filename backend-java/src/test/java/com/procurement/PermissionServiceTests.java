package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.infrastructure.PermissionMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 细粒度 RBAC 通配与校验:buyer:* 覆盖任意 buyer 权限;精确匹配;缺失则拒绝。
class PermissionServiceTests {

  private final PermissionMapper permissionMapper = mock(PermissionMapper.class);
  private final PermissionService permissionService = new PermissionService(permissionMapper);

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  @Test
  void wildcardGrantCoversAnyBuyerPermission() {
    TenantContext.set("tenant-1", null, "user-owner");
    when(permissionMapper.listUserPermissions("user-owner")).thenReturn(List.of("buyer:*"));

    assertThat(permissionService.currentUserHas("buyer:variance:approve")).isTrue();
    assertThat(permissionService.currentUserHas("buyer:report:export")).isTrue();
    permissionService.require("buyer:variance:approve"); // 不抛
  }

  @Test
  void exactGrantMatchesAndUnrelatedDenied() {
    TenantContext.set("tenant-1", null, "user-finance");
    when(permissionMapper.listUserPermissions("user-finance"))
        .thenReturn(List.of("buyer:invoice:read", "buyer:payment:register"));

    assertThat(permissionService.currentUserHas("buyer:payment:register")).isTrue();
    assertThat(permissionService.currentUserHas("buyer:variance:approve")).isFalse();
    assertThatThrownBy(() -> permissionService.require("buyer:variance:approve"))
        .isInstanceOf(PermissionDeniedException.class)
        .hasMessageContaining("buyer:variance:approve");
  }

  @Test
  void prefixWildcardScopedToSegment() {
    TenantContext.set("tenant-1", null, "user-pay");
    when(permissionMapper.listUserPermissions("user-pay")).thenReturn(List.of("buyer:payment:*"));

    assertThat(permissionService.currentUserHas("buyer:payment:register")).isTrue();
    assertThat(permissionService.currentUserHas("buyer:report:export")).isFalse();
  }

  @Test
  void noUserContextDenies() {
    assertThat(permissionService.currentUserHas("buyer:report:export")).isFalse();
  }
}
