package com.procurement.identity.application;

import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.domain.DataScope;
import com.procurement.identity.infrastructure.DataScopeMapper;
import java.util.List;
import org.springframework.stereotype.Service;

// 行级权限:解析当前登录用户的有效数据范围。各业务列表据此做部门收窄。
// 并集语义:任一激活角色为 all → 不受限;全部角色为 department → 仅本部门。
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
    // 全部角色都是 department:收窄到用户所属部门(无部门则约束为不可能命中,返回不可见)。
    return DataScope.department(dataScopeMapper.findUserDepartmentId(userId));
  }
}
