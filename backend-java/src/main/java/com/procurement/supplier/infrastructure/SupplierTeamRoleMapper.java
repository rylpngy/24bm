package com.procurement.supplier.infrastructure;

import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface SupplierTeamRoleMapper {
  record Row(String id, String name, String permissionsJson, String supplierId) {}
  record Grant(String userId, String roleId) {}
  @Select("""
      select id,name,permissions::text permissions_json,supplier_id from roles
      where scope='supplier' and tenant_id is null and
        (supplier_id=#{supplierId} or (supplier_id is null and id in ('role-system-supplier-owner','role-system-supplier-member')))
      order by supplier_id nulls first,name,id
      """)
  List<Row> list(@Param("supplierId") String supplierId);
  @Select("""
      select u.id user_id,ur.role_id from users u join user_roles ur on ur.user_id=u.id
      join roles r on r.id=ur.role_id where u.supplier_id=#{supplierId} and u.tenant_id is null
        and r.scope='supplier' and r.tenant_id is null and (r.supplier_id is null or r.supplier_id=u.supplier_id)
      order by u.id,ur.role_id
      """)
  List<Grant> grants(@Param("supplierId") String supplierId);
  @Select("select exists(select 1 from roles where supplier_id=#{supplierId} and lower(btrim(name))=lower(#{name}) and id != #{id})")
  boolean duplicate(@Param("supplierId") String supplierId,@Param("name") String name,@Param("id") String id);
  @Insert("""
      insert into roles(id,scope,tenant_id,supplier_id,name,permissions)
      values(#{id},'supplier',null,#{supplierId},#{name},#{permissions}::jsonb)
      """)
  void insert(@Param("id") String id,@Param("supplierId") String supplierId,@Param("name") String name,@Param("permissions") String permissions);
  @Update("update roles set name=#{name},permissions=#{permissions}::jsonb where id=#{id} and supplier_id=#{supplierId} and scope='supplier' and tenant_id is null")
  void update(@Param("id") String id,@Param("supplierId") String supplierId,@Param("name") String name,@Param("permissions") String permissions);
  @Update("""
      update users set session_version=session_version+1,updated_at=now()
      where supplier_id=#{supplierId} and tenant_id is null
        and exists(select 1 from user_roles where user_id=users.id and role_id=#{roleId})
      """)
  void invalidateRoleSessions(@Param("supplierId") String supplierId,@Param("roleId") String roleId);
}
