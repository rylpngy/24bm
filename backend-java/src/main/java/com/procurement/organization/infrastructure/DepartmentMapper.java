package com.procurement.organization.infrastructure;

import com.procurement.organization.domain.Department;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface DepartmentMapper {

  @Select("""
      select d.id, d.tenant_id, d.name, d.parent_id, d.status, d.description,
             d.manager_id, u.name as manager_name,
             (select count(*) from users mu
                where mu.department_id = d.id and mu.tenant_id = d.tenant_id
                  and mu.status = 'active') as member_count,
             d.established_on
      from departments d
      left join users u on u.id = d.manager_id
      where d.tenant_id = #{tenantId}
        and d.status = 'active'
      order by d.created_at asc
      """)
  List<Department> listActiveByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select exists (
        select 1
        from departments
        where tenant_id = #{tenantId}
          and id = #{departmentId,jdbcType=VARCHAR}
          and status = 'active'
      )
      """)
  boolean existsActiveByTenantAndId(
      @Param("tenantId") String tenantId,
      @Param("departmentId") String departmentId);

  @Select("""
      select exists (
        select 1
        from users
        where tenant_id = #{tenantId}
          and id = #{userId}
          and department_id = #{departmentId}
          and status = 'active'
      )
      """)
  boolean existsActiveMemberByTenantAndDepartment(
      @Param("tenantId") String tenantId,
      @Param("departmentId") String departmentId,
      @Param("userId") String userId);

  @Select("""
      select d.id, d.tenant_id, d.name, d.parent_id, d.status, d.description,
             d.manager_id, u.name as manager_name,
             (select count(*) from users mu
                where mu.department_id = d.id and mu.tenant_id = d.tenant_id
                  and mu.status = 'active') as member_count,
             d.established_on
      from departments d
      left join users u on u.id = d.manager_id
      where d.tenant_id = #{tenantId}
        and d.id = #{id}
      """)
  Department findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into departments (id, tenant_id, name, parent_id, status)
      values (#{id}, #{tenantId}, #{name}, #{parentId}, #{status,jdbcType=VARCHAR})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("name") String name,
      @Param("parentId") String parentId,
      @Param("status") String status);

  @Update("""
      update departments
      set name = #{name},
          description = #{description},
          manager_id = #{managerId,jdbcType=VARCHAR},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = 'active'
      """)
  int updateDetails(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("name") String name,
      @Param("description") String description,
      @Param("managerId") String managerId);

  @Update("""
      update departments
      set manager_id = null,
          updated_at = now()
      where tenant_id = #{tenantId}
        and manager_id = #{userId}
      """)
  int clearManagerByUserId(
      @Param("tenantId") String tenantId,
      @Param("userId") String userId);

  @Update("""
      update departments
      set manager_id = null,
          updated_at = now()
      where tenant_id = #{tenantId}
        and manager_id = #{userId}
        and id <> #{departmentId}
      """)
  int clearManagerByUserIdExceptDepartment(
      @Param("tenantId") String tenantId,
      @Param("userId") String userId,
      @Param("departmentId") String departmentId);

  @Select("""
      select count(1)
      from users
      where tenant_id = #{tenantId}
        and department_id = #{departmentId}
        and status = 'active'
      """)
  int countActiveMembersByTenantAndDepartment(
      @Param("tenantId") String tenantId,
      @Param("departmentId") String departmentId);

  @Select("""
      select count(1)
      from departments
      where tenant_id = #{tenantId}
        and parent_id = #{parentId}
        and status = 'active'
      """)
  int countActiveChildrenByTenantAndParent(
      @Param("tenantId") String tenantId,
      @Param("parentId") String parentId);

  @Update("""
      update departments
      set status = #{nextStatus}, updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = #{currentStatus}
      """)
  int updateStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("currentStatus") String currentStatus,
      @Param("nextStatus") String nextStatus);
}
