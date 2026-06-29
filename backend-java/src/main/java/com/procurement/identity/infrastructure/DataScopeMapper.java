package com.procurement.identity.infrastructure;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

// 行级权限解析:读取用户激活角色的 data_scope 与用户所属部门。按 user_id 维度(共享作用域)。
@Mapper
public interface DataScopeMapper {

  @Select("""
      select distinct r.data_scope
      from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = #{userId}
      """)
  List<String> listUserRoleDataScopes(@Param("userId") String userId);

  @Select("""
      select department_id
      from users
      where id = #{userId}
      """)
  String findUserDepartmentId(@Param("userId") String userId);
}
