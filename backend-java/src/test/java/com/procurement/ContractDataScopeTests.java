package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.contract.application.ContractApplicationService;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.domain.DataScope;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ContractDataScopeTests {
  @org.junit.jupiter.api.BeforeEach
  void configureAccess() { TestContractAccess.allow(contractApplicationService); }
  private final ContractMapper contractMapper = org.mockito.Mockito.mock(ContractMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final DataScopeService dataScopeService = org.mockito.Mockito.mock(DataScopeService.class);
  private final ContractApplicationService contractApplicationService = new ContractApplicationService(
      contractMapper,
      null,
      purchaseOrderMapper,
      dataScopeService,
      null,
      null,
      null,
      null, null);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listContractsPassesVisibleDepartmentsToMapper() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(dataScopeService.currentUserDataScope())
        .thenReturn(DataScope.departments(List.of("dept-it", "dept-ops")));
    when(contractMapper.listByTenantFiltered(
        "tenant-1",
        "履约中",
        "未归档",
        "supplier-1",
        List.of("dept-it", "dept-ops"),
        null))
        .thenReturn(List.of());

    contractApplicationService.listCurrentTenantContracts("履约中", "未归档", "supplier-1");

    verify(contractMapper).listByTenantFiltered(
        "tenant-1",
        "履约中",
        "未归档",
        "supplier-1",
        List.of("dept-it", "dept-ops"),
        null);
  }

  @Test
  void listContractsPassesRequesterScopeToMapper() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(dataScopeService.currentUserDataScope()).thenReturn(DataScope.self("buyer-user"));
    when(contractMapper.listByTenantFiltered("tenant-1", null, null, null, null, "buyer-user"))
        .thenReturn(List.of());

    contractApplicationService.listCurrentTenantContracts(null, null, null);

    verify(contractMapper).listByTenantFiltered("tenant-1", null, null, null, null, "buyer-user");
  }

  @Test
  void listContractsReturnsEmptyWithoutQueryWhenScopeBlocksAll() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(dataScopeService.currentUserDataScope()).thenReturn(DataScope.departments(List.of()));

    var responses = contractApplicationService.listCurrentTenantContracts("履约中", null, null);

    assertThat(responses).isEmpty();
    verify(contractMapper, never()).listByTenantFiltered(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any());
  }
}
