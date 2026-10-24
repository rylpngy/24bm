package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.contract.application.ContractAccessService;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.DataScope;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ContractArchiveAccessTests {
  private final ContractMapper mapper = mock(ContractMapper.class);
  private final PermissionService permissions = mock(PermissionService.class);
  private final DataScopeService scopes = mock(DataScopeService.class);
  private final ContractAccessService service = new ContractAccessService(mapper, permissions, scopes);

  @AfterEach void cleanup() { TenantContext.clear(); }

  @Test void archiveAuthorizationKeepsManagePermissionWithoutLockingChildEarly() {
    TenantContext.set("t", null, "u");
    when(scopes.currentUserDataScope()).thenReturn(DataScope.unrestricted());
    when(mapper.canAccessAttachment(eq("t"), eq("c"), isNull(), isNull())).thenReturn(true);
    service.requireArchiveAccess("c");
    verify(permissions).require("buyer:contract:manage");
    verify(mapper, never()).lockById(anyString(), anyString());
  }

  @Test void archiveAuthorizationStillRejectsOutOfScopeContract() {
    TenantContext.set("t", null, "u");
    when(scopes.currentUserDataScope()).thenReturn(DataScope.unrestricted());
    assertThatThrownBy(() -> service.requireArchiveAccess("foreign")).isInstanceOf(PermissionDeniedException.class);
    verify(mapper, never()).lockById(anyString(), anyString());
  }
}
