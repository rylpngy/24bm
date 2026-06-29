package com.procurement.identity.domain;

// 当前用户的有效数据范围(行级权限)。departmentRestricted=true 时仅可见 departmentId 部门的数据;
// 取并集语义:用户任一角色为 all 即不受限;全部角色为 department 才按本部门收窄。
public record DataScope(boolean departmentRestricted, String departmentId) {

  public static final String ALL = "all";
  public static final String DEPARTMENT = "department";

  public static DataScope unrestricted() {
    return new DataScope(false, null);
  }

  public static DataScope department(String departmentId) {
    return new DataScope(true, departmentId);
  }

  public static boolean isValid(String value) {
    return ALL.equals(value) || DEPARTMENT.equals(value);
  }
}
