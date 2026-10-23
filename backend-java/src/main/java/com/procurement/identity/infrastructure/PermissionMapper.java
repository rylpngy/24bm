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
      join users u on u.id = ur.user_id and u.status = 'active'
      cross join lateral jsonb_array_elements_text(r.permissions) as perm
      where ur.user_id = #{userId}
        and (r.tenant_id = u.tenant_id or (r.tenant_id is null and u.tenant_id is null))
        and (r.supplier_id is null or r.supplier_id = u.supplier_id)
        and ((u.tenant_id is not null and u.supplier_id is null and r.scope = 'buyer')
          or (u.tenant_id is null and u.supplier_id is not null and r.scope = 'supplier')
          or (u.tenant_id is null and u.supplier_id is null and r.scope = 'platform'))
      """)
  List<String> listUserPermissions(@Param("userId") String userId);
}
