package com.procurement.identity.domain;

import java.util.List;

// 当前用户的有效数据范围(行级权限)。
// restricted=false:不受限(全部数据)。restricted=true:按 departmentIds(部门 IN)或 requesterId(仅本人)收窄。
public record DataScope(boolean restricted, List<String> departmentIds, String requesterId) {

  public static final String ALL = "all";
  public static final String DEPARTMENT = "department";
  public static final String DEPARTMENT_AND_BELOW = "department_and_below";
  public static final String SELF = "self";

  public static DataScope unrestricted() {
    return new DataScope(false, List.of(), null);
  }

  // 按部门集合收窄(department=仅本部门;department_and_below=本部门 + 下级,传子树)。
  public static DataScope departments(List<String> ids) {
    return new DataScope(true, ids == null ? List.of() : ids, null);
  }

  // 仅本人创建的数据。
  public static DataScope self(String userId) {
    return new DataScope(true, List.of(), userId);
  }

  public static boolean isValid(String value) {
    return ALL.equals(value) || DEPARTMENT.equals(value)
        || DEPARTMENT_AND_BELOW.equals(value) || SELF.equals(value);
  }

  // 受限但既无可见部门也无本人维度 → 不可见(返回空)。
  public boolean blocksAll() {
    return restricted && (departmentIds == null || departmentIds.isEmpty()) && requesterId == null;
  }
}
