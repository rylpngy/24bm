package com.procurement;

import com.procurement.finance.application.FinanceAccessService;
import com.procurement.identity.domain.DataScope;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyString;

final class TestFinanceAccess {
  static FinanceAccessService unrestricted() {
    var access = mock(FinanceAccessService.class);
    when(access.canRead()).thenReturn(true);
    when(access.readScope()).thenReturn(DataScope.unrestricted());
    when(access.requireScope(anyString())).thenReturn(DataScope.unrestricted());
    return access;
  }
}
