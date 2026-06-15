package com.procurement.platform.infrastructure;

import com.procurement.platform.domain.PlatformTenant;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PlatformTenantMapper {

  @Select("""
      select id, name, plan, status, enabled_features::text as enabled_features_json, user_limit
      from tenants
      order by created_at desc
      """)
  @Results(id = "platformTenantResults", value = {
      @Result(column = "enabled_features_json", property = "enabledFeaturesJson"),
      @Result(column = "user_limit", property = "userLimit")
  })
  List<PlatformTenant> listAll();

  @Select("""
      select count(1)
      from tenants
      """)
  int countAll();

  @Select("""
      select id, name, plan, status, enabled_features::text as enabled_features_json, user_limit
      from tenants
      where id = #{tenantId}
      """)
  @Results(id = "singlePlatformTenantResults", value = {
      @Result(column = "enabled_features_json", property = "enabledFeaturesJson"),
      @Result(column = "user_limit", property = "userLimit")
  })
  PlatformTenant findById(@Param("tenantId") String tenantId);

  @Update("""
      update tenants
      set enabled_features = #{enabledFeaturesJson}::jsonb,
          updated_at = now()
      where id = #{tenantId}
      """)
  int updateEnabledFeatures(
      @Param("tenantId") String tenantId,
      @Param("enabledFeaturesJson") String enabledFeaturesJson);
}
