package com.procurement.identity.infrastructure;

import com.procurement.identity.domain.BuyerUser;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface BuyerUserMapper {

  @Select("""
      select u.id, u.tenant_id, u.name, u.mobile, u.email, u.status, u.department_id, min(r.id) as role_id
      from users u
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id and r.scope = 'buyer'
      where u.tenant_id = #{tenantId}
      group by u.id, u.tenant_id, u.name, u.mobile, u.email, u.status, u.department_id, u.created_at
      order by u.created_at desc
      """)
  @Results(id = "buyerUserResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "department_id", property = "departmentId"),
      @Result(column = "role_id", property = "roleId")
  })
  List<BuyerUser> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select u.id, u.tenant_id, u.name, u.mobile, u.email, u.status, u.department_id, min(r.id) as role_id
      from users u
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id and r.scope = 'buyer'
      where u.tenant_id = #{tenantId} and u.id = #{id}
      group by u.id, u.tenant_id, u.name, u.mobile, u.email, u.status, u.department_id
      """)
  @Results(id = "singleBuyerUserResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "department_id", property = "departmentId"),
      @Result(column = "role_id", property = "roleId")
  })
  BuyerUser findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select count(1)
      from users
      where tenant_id = #{tenantId}
      """)
  int countByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select exists(
        select 1
        from users
        where tenant_id = #{tenantId}
          and id = #{id}
      )
      """)
  boolean existsByTenantAndId(
      @Param("tenantId") String tenantId,
      @Param("id") String id);

  @Select("""
      select u.id
      from users u
      join user_roles ur on ur.user_id = u.id
      join roles r on r.id = ur.role_id
      where u.tenant_id = #{tenantId}
        and u.status = 'active'
        and r.id = #{roleId}
        and r.scope = 'buyer'
      order by u.created_at asc
      limit 1
      """)
  String findDefaultApproverId(
      @Param("tenantId") String tenantId,
      @Param("roleId") String roleId);

  @Select("""
      select exists(
        select 1
        from roles
        where tenant_id = #{tenantId}
          and id = #{roleId}
          and scope = 'buyer'
      )
      """)
  boolean existsBuyerRoleByTenantAndId(
      @Param("tenantId") String tenantId,
      @Param("roleId") String roleId);

  @Insert("""
      insert into users (id, tenant_id, name, mobile, email, status, department_id, password_hash)
      values (#{id}, #{tenantId}, #{name}, #{mobile}, #{email}, #{status}, #{departmentId}, #{passwordHash})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("name") String name,
      @Param("mobile") String mobile,
      @Param("email") String email,
      @Param("status") String status,
      @Param("departmentId") String departmentId,
      @Param("passwordHash") String passwordHash);

  @Insert("""
      insert into user_roles (user_id, role_id)
      values (#{userId}, #{roleId})
      """)
  void assignRole(
      @Param("userId") String userId,
      @Param("roleId") String roleId);

  @Update("""
      with deleted as (
        delete from user_roles ur
        using users u, roles r
        where ur.user_id = u.id
          and ur.role_id = r.id
          and u.tenant_id = #{tenantId}
          and u.id = #{userId}
          and r.scope = 'buyer'
      )
      insert into user_roles (user_id, role_id)
      select u.id, r.id
      from users u
      join roles r on r.id = #{roleId}
      where u.tenant_id = #{tenantId}
        and u.id = #{userId}
        and r.tenant_id = #{tenantId}
        and r.scope = 'buyer'
      """)
  void replaceRole(
      @Param("tenantId") String tenantId,
      @Param("userId") String userId,
      @Param("roleId") String roleId);

  @Update("""
      update users
      set status = #{status},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{userId}
      """)
  void updateStatus(
      @Param("tenantId") String tenantId,
      @Param("userId") String userId,
      @Param("status") String status);

  @Update("""
      update users
      set password_hash = #{passwordHash},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{userId}
      """)
  void updatePasswordHash(
      @Param("tenantId") String tenantId,
      @Param("userId") String userId,
      @Param("passwordHash") String passwordHash);
}
