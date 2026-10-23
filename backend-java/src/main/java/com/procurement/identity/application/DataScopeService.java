package com.procurement.identity.application;

import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.domain.DataScope;
import com.procurement.identity.infrastructure.DataScopeMapper;
import java.util.List;
import org.springframework.stereotype.Service;

// 行级权限:解析当前登录用户的有效数据范围。各业务列表据此做收窄。
// 并集语义:取最宽档(all > department_and_below > department > self);无角色范围拒绝访问。
@Service
public class DataScopeService {
  private final DataScopeMapper dataScopeMapper;

  public DataScopeService(DataScopeMapper dataScopeMapper) {
    this.dataScopeMapper = dataScopeMapper;
  }

  public DataScope currentUserDataScope() {
    String userId = TenantContext.userId();
    if (userId == null) {
      return DataScope.departments(List.of());
    }
    return userDataScope(TenantContext.tenantId(), userId);
  }

  public void requireRecordAccess(String departmentId, String creatorId) {
    DataScope scope = currentUserDataScope();
    if (!scope.restricted()) return;
    boolean allowed = scope.requesterId() != null
        ? scope.requesterId().equals(creatorId)
        : departmentId != null && scope.departmentIds().contains(departmentId);
    if (!allowed) throw new com.procurement.common.tenant.PermissionDeniedException("当前数据范围无权访问该业务记录");
  }

  public void requireCreatorAccess(String creatorId) {
    requireRecordAccess(creatorId == null ? null : dataScopeMapper.findUserDepartmentId(creatorId), creatorId);
  }

  public DataScope userDataScope(String tenantId, String userId) {
    List<String> scopes = dataScopeMapper.listUserRoleDataScopes(userId);
    if (scopes == null || scopes.isEmpty()) {
      return DataScope.departments(List.of());
    }
    if (scopes.contains(DataScope.ALL)) {
      return DataScope.unrestricted();
    }
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
