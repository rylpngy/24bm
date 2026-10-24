package com.procurement.identity.infrastructure;

import com.procurement.identity.domain.BuyerUser;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface BuyerUserMapper extends BuyerAdministrationMapper {

  @Select("""
      select u.id, u.tenant_id, u.name, u.mobile, u.email, u.status, u.department_id, min(r.id) as role_id, u.employee_no, u.job_title
      from users u
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id and r.scope = 'buyer'
      where u.tenant_id = #{tenantId}
      group by u.id, u.tenant_id, u.name, u.mobile, u.email, u.status, u.department_id, u.created_at, u.employee_no, u.job_title
      order by u.created_at desc
      """)
  List<BuyerUser> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      <script>
      select u.id, u.tenant_id, u.name, u.mobile, u.email, u.status, u.department_id, min(r.id) as role_id, u.employee_no, u.job_title
      from users u
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id and r.scope = 'buyer'
      where u.tenant_id = #{tenantId}
        <if test="status != null and status != ''">
        and u.status = #{status}
        </if>
        <if test="departmentId != null and departmentId != ''">
        and u.department_id = #{departmentId}
        </if>
        <if test="keyword != null and keyword != ''">
        and (
          u.name ilike concat('%', #{keyword}, '%')
          or u.mobile ilike concat('%', #{keyword}, '%')
          or u.email ilike concat('%', #{keyword}, '%')
        )
        </if>
      group by u.id, u.tenant_id, u.name, u.mobile, u.email, u.status, u.department_id, u.created_at, u.employee_no, u.job_title
      order by u.created_at desc
      </script>
      """)
  List<BuyerUser> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("departmentId") String departmentId,
      @Param("keyword") String keyword);

  @Select("""
      select u.id, u.tenant_id, u.name, u.mobile, u.email, u.status, u.department_id, min(r.id) as role_id, u.employee_no, u.job_title
      from users u
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id and r.scope = 'buyer'
      where u.tenant_id = #{tenantId} and u.id = #{id}
      group by u.id, u.tenant_id, u.name, u.mobile, u.email, u.status, u.department_id, u.employee_no, u.job_title
      """)
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
      select exists(
        select 1
        from users
        where tenant_id = #{tenantId}
          and employee_no is not null
          and upper(employee_no) = upper(#{employeeNo})
          and (#{excludedUserId,jdbcType=VARCHAR} is null or id <> #{excludedUserId,jdbcType=VARCHAR})
      )
      """)
  boolean existsByEmployeeNoExcludingUser(
      @Param("tenantId") String tenantId,
      @Param("employeeNo") String employeeNo,
      @Param("excludedUserId") String excludedUserId);

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

  @Select("""
      select r.id
      from users u
      join user_roles ur on ur.user_id = u.id
      join roles r on r.id = ur.role_id
      where u.tenant_id = #{tenantId}
        and u.id = #{userId}
        and r.tenant_id = #{tenantId}
        and r.scope = 'buyer'
      order by r.id
      """)
  List<String> listBuyerRoleIdsByTenantAndUser(
      @Param("tenantId") String tenantId,
      @Param("userId") String userId);

  @Select("""
      select distinct u.id
      from users u
      join user_roles ur on ur.user_id = u.id
      join roles r on r.id = ur.role_id
      where u.tenant_id = #{tenantId}
        and u.status = 'active'
        and r.tenant_id = #{tenantId}
        and r.scope = 'buyer'
        and r.id = #{roleId}
      order by u.id
      """)
  List<String> listActiveBuyerUserIdsByTenantAndRole(
      @Param("tenantId") String tenantId,
      @Param("roleId") String roleId);

  @Select("""
      select name
      from roles
      where tenant_id = #{tenantId}
        and id = #{roleId}
        and scope = 'buyer'
      """)
  String findBuyerRoleNameByTenantAndId(
      @Param("tenantId") String tenantId,
      @Param("roleId") String roleId);

  @Select("""
      select id
      from roles
      where tenant_id = #{tenantId}
        and name = #{name}
        and scope = 'buyer'
      limit 1
      """)
  String findBuyerRoleIdByName(
      @Param("tenantId") String tenantId,
      @Param("name") String name);

  @Insert("""
      insert into users
        (id, tenant_id, name, mobile, email, status, department_id, password_hash, employee_no, job_title)
      values
        (#{id}, #{tenantId}, #{name}, #{mobile}, #{email}, #{status}, #{departmentId}, #{passwordHash},
         #{employeeNo,jdbcType=VARCHAR}, #{jobTitle})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("name") String name,
      @Param("mobile") String mobile,
      @Param("email") String email,
      @Param("status") String status,
      @Param("departmentId") String departmentId,
      @Param("passwordHash") String passwordHash,
      @Param("employeeNo") String employeeNo,
      @Param("jobTitle") String jobTitle);

  @Insert("""
      insert into user_roles (user_id, role_id)
      values (#{userId}, #{roleId})
      """)
  void assignRole(
      @Param("userId") String userId,
      @Param("roleId") String roleId);

  @Delete("""
      delete from user_roles ur
      using users u, roles r
      where ur.user_id = u.id
        and ur.role_id = r.id
        and u.tenant_id = #{tenantId}
        and u.id = #{userId}
        and r.scope = 'buyer'
      """)
  void deleteBuyerRoles(
      @Param("tenantId") String tenantId,
      @Param("userId") String userId);

  @Insert("""
      <script>
      insert into user_roles (user_id, role_id)
      values
      <foreach collection="roleIds" item="roleId" separator=",">
        (#{userId}, #{roleId})
      </foreach>
      </script>
      """)
  void assignRoles(
      @Param("userId") String userId,
      @Param("roleIds") List<String> roleIds);

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
      set name = #{name},
          mobile = #{mobile,jdbcType=VARCHAR},
          email = #{email,jdbcType=VARCHAR},
          department_id = #{departmentId},
          employee_no = #{employeeNo,jdbcType=VARCHAR},
          job_title = #{jobTitle,jdbcType=VARCHAR},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{userId}
      """)
  int updateDetails(
      @Param("tenantId") String tenantId,
      @Param("userId") String userId,
      @Param("name") String name,
      @Param("mobile") String mobile,
      @Param("email") String email,
      @Param("departmentId") String departmentId,
      @Param("employeeNo") String employeeNo,
      @Param("jobTitle") String jobTitle);

  @Update("""
      update users
      set department_id = #{departmentId},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{userId}
      """)
  int updateDepartment(
      @Param("tenantId") String tenantId,
      @Param("userId") String userId,
      @Param("departmentId") String departmentId);

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
