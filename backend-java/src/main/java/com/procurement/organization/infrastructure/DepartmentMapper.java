package com.procurement.organization.infrastructure;

import com.procurement.organization.domain.Department;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface DepartmentMapper {

  @Select("""
      select id, tenant_id, name, parent_id, status
      from departments
      where tenant_id = #{tenantId}
        and status = 'active'
      order by created_at asc
      """)
  @Results(id = "departmentResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "parent_id", property = "parentId")
  })
  List<Department> listActiveByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select exists (
        select 1
        from departments
        where tenant_id = #{tenantId}
          and id = #{departmentId}
          and status = 'active'
      )
      """)
  boolean existsActiveByTenantAndId(
      @Param("tenantId") String tenantId,
      @Param("departmentId") String departmentId);
}
