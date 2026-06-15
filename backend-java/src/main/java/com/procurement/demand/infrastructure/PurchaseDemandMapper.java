package com.procurement.demand.infrastructure;

import com.procurement.demand.domain.PurchaseDemand;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PurchaseDemandMapper {

  @Select("""
      select id, tenant_id, title, department_id, requester_id, budget, status, created_at, updated_at
      from purchase_demands
      where tenant_id = #{tenantId}
      order by created_at desc
      """)
  @Results(id = "purchaseDemandResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "department_id", property = "departmentId"),
      @Result(column = "requester_id", property = "requesterId"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  List<PurchaseDemand> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select id, tenant_id, title, department_id, requester_id, budget, status, created_at, updated_at
      from purchase_demands
      where tenant_id = #{tenantId} and id = #{id}
      """)
  @Results(id = "singlePurchaseDemandResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "department_id", property = "departmentId"),
      @Result(column = "requester_id", property = "requesterId"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  PurchaseDemand findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into purchase_demands (id, tenant_id, title, department_id, requester_id, budget, status)
      values (#{id}, #{tenantId}, #{title}, #{departmentId}, #{requesterId}, #{budget}, #{status})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("title") String title,
      @Param("departmentId") String departmentId,
      @Param("requesterId") String requesterId,
      @Param("budget") BigDecimal budget,
      @Param("status") String status);

  @Update("""
      update purchase_demands
      set status = #{status}, updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int updateStatus(@Param("tenantId") String tenantId, @Param("id") String id, @Param("status") String status);

  @Select("""
      select count(*)
      from purchase_demands
      where tenant_id = #{tenantId}
        and department_id = #{departmentId}
      """)
  int countByTenantAndDepartment(
      @Param("tenantId") String tenantId,
      @Param("departmentId") String departmentId);
}
