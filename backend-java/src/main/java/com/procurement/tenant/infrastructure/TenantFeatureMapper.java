package com.procurement.tenant.infrastructure;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TenantFeatureMapper {

  @Select("""
      select enabled_features::text
      from tenants
      where id = #{tenantId}
      """)
  String findEnabledFeaturesJson(@Param("tenantId") String tenantId);
}
