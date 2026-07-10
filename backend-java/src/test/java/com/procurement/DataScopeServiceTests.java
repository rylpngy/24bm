package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.domain.DataScope;
import com.procurement.identity.infrastructure.DataScopeMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class DataScopeServiceTests {
  private final DataScopeMapper dataScopeMapper = org.mockito.Mockito.mock(DataScopeMapper.class);
  private final DataScopeService dataScopeService = new DataScopeService(dataScopeMapper);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void allRoleKeepsDataScopeUnrestricted() {
    TenantContext.set("tenant-1", null, "buyer-user-1");
    when(dataScopeMapper.listUserRoleDataScopes("buyer-user-1"))
        .thenReturn(List.of(DataScope.SELF, DataScope.ALL));

    DataScope scope = dataScopeService.currentUserDataScope();

    assertThat(scope.restricted()).isFalse();
    verify(dataScopeMapper, never()).findUserDepartmentId("buyer-user-1");
  }

  @Test
  void departmentAndBelowUsesCurrentTenantDepartmentSubtree() {
    TenantContext.set("tenant-1", null, "buyer-user-1");
    when(dataScopeMapper.listUserRoleDataScopes("buyer-user-1"))
        .thenReturn(List.of(DataScope.SELF, DataScope.DEPARTMENT_AND_BELOW));
    when(dataScopeMapper.findUserDepartmentId("buyer-user-1")).thenReturn("dept-it");
    when(dataScopeMapper.listDepartmentSubtree("tenant-1", "dept-it"))
        .thenReturn(List.of("dept-it", "dept-devops"));

    DataScope scope = dataScopeService.currentUserDataScope();

    assertThat(scope.restricted()).isTrue();
    assertThat(scope.departmentIds()).containsExactly("dept-it", "dept-devops");
    assertThat(scope.requesterId()).isNull();
  }

  @Test
  void departmentRoleRestrictsToCurrentUserDepartmentOnly() {
    TenantContext.set("tenant-1", null, "buyer-user-1");
    when(dataScopeMapper.listUserRoleDataScopes("buyer-user-1"))
        .thenReturn(List.of(DataScope.SELF, DataScope.DEPARTMENT));
    when(dataScopeMapper.findUserDepartmentId("buyer-user-1")).thenReturn("dept-finance");

    DataScope scope = dataScopeService.currentUserDataScope();

    assertThat(scope.restricted()).isTrue();
    assertThat(scope.departmentIds()).containsExactly("dept-finance");
    assertThat(scope.requesterId()).isNull();
    verify(dataScopeMapper, never()).listDepartmentSubtree("tenant-1", "dept-finance");
  }

  @Test
  void selfRoleRestrictsToCurrentUserOnly() {
    TenantContext.set("tenant-1", null, "buyer-user-1");
    when(dataScopeMapper.listUserRoleDataScopes("buyer-user-1"))
        .thenReturn(List.of(DataScope.SELF));

    DataScope scope = dataScopeService.currentUserDataScope();

    assertThat(scope.restricted()).isTrue();
    assertThat(scope.departmentIds()).isEmpty();
    assertThat(scope.requesterId()).isEqualTo("buyer-user-1");
  }
}
