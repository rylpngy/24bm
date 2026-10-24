package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.contract.application.ContractAccessService;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.DataScope;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ContractRecordAccessTests {
  final ContractMapper mapper = mock(ContractMapper.class);
  final PermissionService permissions = mock(PermissionService.class);
  final DataScopeService scopes = mock(DataScopeService.class);
  final ContractAccessService access = new ContractAccessService(mapper, permissions, scopes);

  @BeforeEach void setTenant() { TenantContext.set("t", null, "u"); }
  @AfterEach void clearTenant() { TenantContext.clear(); }

  @Test void readPermissionCannotBeUsedForContractMutation() {
    doThrow(new PermissionDeniedException("denied")).when(permissions).require("buyer:contract:manage");
    assertThatThrownBy(() -> access.requireContract("c", true)).isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(mapper);
  }

  @Test void recordOutsideDepartmentCannotBeReadOrMutated() {
    when(scopes.currentUserDataScope()).thenReturn(DataScope.departments(List.of("own")));
    assertThatThrownBy(() -> access.requireContract("other", false)).isInstanceOf(PermissionDeniedException.class);
    assertThatThrownBy(() -> access.requireContract("other", true)).isInstanceOf(PermissionDeniedException.class);
    verify(mapper, never()).lockById(anyString(), anyString());
  }

  @Test void creationChecksTheActualOrderNotJustTenant() {
    when(scopes.currentUserDataScope()).thenReturn(DataScope.self("u"));
    assertThatThrownBy(() -> access.requireOrder("other-order")).isInstanceOf(PermissionDeniedException.class);
    verify(mapper).canAccessOrder("t", "other-order", null, "u");
  }

  @Test void permittedWriteLocksTheScopedRecord() {
    when(scopes.currentUserDataScope()).thenReturn(DataScope.unrestricted());
    when(mapper.canAccessAttachment("t", "c", null, null)).thenReturn(true);
    when(mapper.lockById("t", "c")).thenReturn("c");
    access.requireContract("c", true);
    verify(permissions).require("buyer:contract:manage");
    verify(mapper).lockById("t", "c");
  }
}
