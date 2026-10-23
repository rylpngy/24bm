package com.procurement;

import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.domain.DataScope;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

final class TestDataScopes {
  static DataScopeService unrestricted() {
    var scopes = mock(DataScopeService.class);
    when(scopes.currentUserDataScope()).thenReturn(DataScope.unrestricted());
    return scopes;
  }
}
