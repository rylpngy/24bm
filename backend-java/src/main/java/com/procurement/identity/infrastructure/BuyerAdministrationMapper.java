package com.procurement.identity.infrastructure;

import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

// Inherited by both administration mappers so user and role writes share one tenant lock.
public interface BuyerAdministrationMapper {
  @Select("select id from tenants where id = #{tenantId} for update")
  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  String lockAdministrationTenant(@Param("tenantId") String tenantId);

  @Select("""
      select count(distinct u.id)
      from users u
      join user_roles ur on ur.user_id = u.id
      join roles r on r.id = ur.role_id and r.tenant_id = u.tenant_id
      where u.tenant_id = #{tenantId} and u.status = 'active' and u.supplier_id is null
        and r.scope = 'buyer' and r.supplier_id is null
        and (r.permissions @> '["buyer:*"]'::jsonb
          or r.permissions @> '["buyer:role:*"]'::jsonb
          or r.permissions @> '["buyer:role:manage"]'::jsonb)
      """)
  @Options(useCache = false)
  int countActiveFullAdministrators(@Param("tenantId") String tenantId);
}
