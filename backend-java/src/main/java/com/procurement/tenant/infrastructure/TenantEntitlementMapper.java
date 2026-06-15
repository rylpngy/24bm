package com.procurement.tenant.infrastructure;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TenantEntitlementMapper {

  @Select("""
      select user_limit
      from tenants
      where id = #{tenantId}
      """)
  Integer findUserLimit(@Param("tenantId") String tenantId);
}
