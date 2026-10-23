package com.procurement;

import com.procurement.order.application.OrderAccessService;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyString;

final class TestOrderAccess {
  static OrderAccessService unrestricted() {
    var access = mock(OrderAccessService.class);
    when(access.canRead(anyString())).thenReturn(true);
    when(access.visibleOrders(anyString())).thenReturn(id -> true);
    return access;
  }
}
