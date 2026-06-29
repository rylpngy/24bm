package com.procurement.identity.application;

import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.domain.DataScope;
import com.procurement.identity.infrastructure.DataScopeMapper;
import java.util.List;
import org.springframework.stereotype.Service;

// 行级权限:解析当前登录用户的有效数据范围。各业务列表据此做收窄。
// 并集语义:取最宽档(all > department_and_below > department > self);无角色范围 → 不受限。
@Service
public class DataScopeService {
  private final DataScopeMapper dataScopeMapper;

  public DataScopeService(DataScopeMapper dataScopeMapper) {
    this.dataScopeMapper = dataScopeMapper;
  }

  public DataScope currentUserDataScope() {
    String userId = TenantContext.userId();
    if (userId == null) {
      return DataScope.unrestricted();
    }
    List<String> scopes = dataScopeMapper.listUserRoleDataScopes(userId);
    if (scopes == null || scopes.isEmpty() || scopes.contains(DataScope.ALL)) {
      return DataScope.unrestricted();
    }
    String tenantId = TenantContext.tenantId();
    if (scopes.contains(DataScope.DEPARTMENT_AND_BELOW)) {
      String dept = dataScopeMapper.findUserDepartmentId(userId);
      return dept == null
          ? DataScope.departments(List.of())
          : DataScope.departments(dataScopeMapper.listDepartmentSubtree(tenantId, dept));
    }
    if (scopes.contains(DataScope.DEPARTMENT)) {
      String dept = dataScopeMapper.findUserDepartmentId(userId);
      return DataScope.departments(dept == null ? List.of() : List.of(dept));
    }
    // 仅本人:只能看自己创建的数据。
    return DataScope.self(userId);
  }
}
