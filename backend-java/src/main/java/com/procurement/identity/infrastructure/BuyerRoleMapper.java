package com.procurement.identity.infrastructure;

import com.procurement.identity.domain.BuyerRole;
import java.util.List;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
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

  @Select("""
      select exists (
        select 1
        from roles
        where tenant_id = #{tenantId}
          and scope = 'buyer'
          and lower(name) = lower(#{name})
          and (#{excludeRoleId,jdbcType=VARCHAR} is null or id <> #{excludeRoleId})
      )
      """)
  boolean existsBuyerRoleByTenantAndName(
      @Param("tenantId") String tenantId,
      @Param("name") String name,
      @Param("excludeRoleId") String excludeRoleId);

  @Insert("""
      insert into roles (id, tenant_id, scope, name, permissions, data_scope)
      values (#{id}, #{tenantId}, 'buyer', #{name}, #{permissionsJson}::jsonb, #{dataScope})
      """)
  void insertBuyerRole(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("name") String name,
      @Param("permissionsJson") String permissionsJson,
      @Param("dataScope") String dataScope);

  @Update("""
      update roles
      set name = #{name},
          permissions = #{permissionsJson}::jsonb,
          data_scope = #{dataScope}
      where tenant_id = #{tenantId}
        and scope = 'buyer'
        and id = #{id}
      """)
  int updateDetails(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("name") String name,
      @Param("permissionsJson") String permissionsJson,
      @Param("dataScope") String dataScope);

  @Select("""
      select count(1)
      from user_roles ur
      join users u on u.id = ur.user_id
      where ur.role_id = #{roleId}
        and u.tenant_id = #{tenantId}
      """)
  int countUsersByTenantAndRoleId(
      @Param("tenantId") String tenantId,
      @Param("roleId") String roleId);

  @Delete("""
      delete from roles
      where tenant_id = #{tenantId}
        and scope = 'buyer'
        and id = #{id}
      """)
  int deleteBuyerRole(@Param("tenantId") String tenantId, @Param("id") String id);

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
