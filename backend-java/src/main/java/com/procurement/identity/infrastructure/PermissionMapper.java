package com.procurement.identity.infrastructure;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface PermissionMapper {

  // 展平用户所有激活角色的 permissions(jsonb 数组)为去重的权限字符串列表。
  @Select("""
      select distinct perm
      from user_roles ur
      join roles r on r.id = ur.role_id
      cross join lateral jsonb_array_elements_text(r.permissions) as perm
      where ur.user_id = #{userId}
      """)
  List<String> listUserPermissions(@Param("userId") String userId);
}
