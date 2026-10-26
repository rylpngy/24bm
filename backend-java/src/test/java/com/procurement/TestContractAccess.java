package com.procurement;

import com.procurement.contract.application.ContractAccessService;
import com.procurement.contract.application.ContractApplicationService;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.DataScope;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

final class TestContractAccess {
  private TestContractAccess() {}

  static void allow(ContractApplicationService service) {
    var mapper = (ContractMapper) ReflectionTestUtils.getField(service, "contractMapper");
    var scopes = Mockito.mock(DataScopeService.class);
    Mockito.when(scopes.currentUserDataScope()).thenReturn(DataScope.unrestricted());
    Mockito.when(mapper.canAccessAttachment(Mockito.anyString(), Mockito.anyString(), Mockito.isNull(), Mockito.isNull())).thenReturn(true);
    Mockito.when(mapper.canAccessOrder(Mockito.anyString(), Mockito.anyString(), Mockito.isNull(), Mockito.isNull())).thenReturn(true);
    Mockito.when(mapper.lockById(Mockito.anyString(), Mockito.anyString())).thenAnswer(invocation -> invocation.getArgument(1));
    Mockito.when(mapper.lockOrderStatus(Mockito.anyString(),Mockito.anyString())).thenReturn("待发货");
    ReflectionTestUtils.setField(service, "contractAccess", new ContractAccessService(
        mapper, Mockito.mock(PermissionService.class), scopes));
  }
}
