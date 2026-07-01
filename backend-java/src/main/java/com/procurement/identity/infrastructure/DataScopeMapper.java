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
        and r.scope = 'buyer'
        and r.status = 'active'
      """)
  List<String> listUserRoleDataScopes(@Param("userId") String userId);

  @Select("""
      select department_id
      from users
      where id = #{userId}
      """)
  String findUserDepartmentId(@Param("userId") String userId);

  // 部门子树:给定部门 + 其全部下级部门 id(递归)。用于「本部门及下级」数据范围。
  @Select("""
      with recursive subtree as (
        select id from departments
          where tenant_id = #{tenantId} and id = #{rootId} and status = 'active'
        union all
        select d.id from departments d
          join subtree s on d.parent_id = s.id
          where d.tenant_id = #{tenantId} and d.status = 'active'
      )
      select id from subtree
      """)
  List<String> listDepartmentSubtree(
      @Param("tenantId") String tenantId,
      @Param("rootId") String rootId);
}
