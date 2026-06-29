package com.procurement.identity.infrastructure;

import com.procurement.identity.domain.BuyerRole;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface BuyerRoleMapper {

  @Select("""
      select id, tenant_id, name, permissions::text as permissions_json, data_scope
      from roles
      where tenant_id = #{tenantId}
        and scope = 'buyer'
      order by name asc
      """)
  List<BuyerRole> listBuyerRolesByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select id, tenant_id, name, permissions::text as permissions_json, data_scope
      from roles
      where tenant_id = #{tenantId} and scope = 'buyer' and id = #{id}
      """)
  BuyerRole findBuyerRoleByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Update("""
      update roles set permissions = #{permissionsJson}::jsonb
      where tenant_id = #{tenantId} and scope = 'buyer' and id = #{id}
      """)
  int updatePermissions(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("permissionsJson") String permissionsJson);

  @Update("""
      update roles set data_scope = #{dataScope}
      where tenant_id = #{tenantId} and scope = 'buyer' and id = #{id}
      """)
  int updateDataScope(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("dataScope") String dataScope);
}
