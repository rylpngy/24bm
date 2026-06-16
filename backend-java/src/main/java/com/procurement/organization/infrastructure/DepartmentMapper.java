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
      select id, tenant_id, name, parent_id, status
      from departments
      where tenant_id = #{tenantId}
        and status = 'active'
      order by created_at asc
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
      select id, tenant_id, name, parent_id, status
      from departments
      where tenant_id = #{tenantId}
        and id = #{id}
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
