package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.infrastructure.DataScopeMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class DataScopeFailClosedTests {
  private final DataScopeMapper mapper = mock(DataScopeMapper.class);
  private final DataScopeService service = new DataScopeService(mapper);

  @AfterEach
  void clearContext() { TenantContext.clear(); }

  @Test
  void missingUserDeniesAllData() {
    TenantContext.clear();
    assertThat(service.currentUserDataScope().blocksAll()).isTrue();
  }

  @Test
  void missingRolesDoNotGrantTenantWideAccess() {
    TenantContext.set("tenant", null, "user");
    when(mapper.listUserRoleDataScopes("user")).thenReturn(List.of());
    assertThat(service.currentUserDataScope().blocksAll()).isTrue();
  }

  @Test
  void explicitAllScopeStillGrantsAccess() {
    TenantContext.set("tenant", null, "user");
    when(mapper.listUserRoleDataScopes("user")).thenReturn(List.of("all"));
    assertThat(service.currentUserDataScope().restricted()).isFalse();
  }
}
