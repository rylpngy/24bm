package com.procurement.demand.infrastructure;

import com.procurement.demand.domain.PurchaseDemand;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PurchaseDemandMapper {

  @Select("""
      select id, tenant_id, title, department_id, requester_id, budget, status, created_at, updated_at,
             expected_delivery_date, priority, purpose
      from purchase_demands
      where tenant_id = #{tenantId}
      order by created_at desc
      """)
  List<PurchaseDemand> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      <script>
      select id, tenant_id, title, department_id, requester_id, budget, status, created_at, updated_at,
             expected_delivery_date, priority, purpose
      from purchase_demands
      where tenant_id = #{tenantId}
        <if test="status != null and status != ''">
        and status = #{status}
        </if>
        <if test="departmentId != null and departmentId != ''">
        and department_id = #{departmentId}
        </if>
        <if test="keyword != null and keyword != ''">
        and title ilike concat('%', #{keyword}, '%')
        </if>
      order by created_at desc
      </script>
      """)
  List<PurchaseDemand> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("departmentId") String departmentId,
      @Param("keyword") String keyword);

  @Select("""
      select id, tenant_id, title, department_id, requester_id, budget, status, created_at, updated_at,
             expected_delivery_date, priority, purpose
      from purchase_demands
      where tenant_id = #{tenantId} and id = #{id}
      """)
  PurchaseDemand findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into purchase_demands (
        id, tenant_id, title, department_id, requester_id, budget, status,
        expected_delivery_date, priority, purpose
      ) values (
        #{id}, #{tenantId}, #{title}, #{departmentId}, #{requesterId}, #{budget}, #{status,jdbcType=VARCHAR},
        #{expectedDeliveryDate,jdbcType=DATE}, #{priority}, #{purpose}
      )
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("title") String title,
      @Param("departmentId") String departmentId,
      @Param("requesterId") String requesterId,
      @Param("budget") BigDecimal budget,
      @Param("status") String status,
      @Param("expectedDeliveryDate") java.time.LocalDate expectedDeliveryDate,
      @Param("priority") String priority,
      @Param("purpose") String purpose);

  @Update("""
      update purchase_demands
      set status = #{status}, updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int updateStatus(@Param("tenantId") String tenantId, @Param("id") String id, @Param("status") String status);

  @Update("""
      update purchase_demands
      set title = #{title},
          department_id = #{departmentId},
          budget = #{budget},
          expected_delivery_date = #{expectedDeliveryDate,jdbcType=DATE},
          priority = #{priority},
          purpose = #{purpose},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = '草稿'
      """)
  int updateDraft(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("title") String title,
      @Param("departmentId") String departmentId,
      @Param("budget") BigDecimal budget,
      @Param("expectedDeliveryDate") java.time.LocalDate expectedDeliveryDate,
      @Param("priority") String priority,
      @Param("purpose") String purpose);

  @Select("""
      select count(*)
      from purchase_demands
      where tenant_id = #{tenantId}
        and department_id = #{departmentId,jdbcType=VARCHAR}
      """)
  int countByTenantAndDepartment(
      @Param("tenantId") String tenantId,
      @Param("departmentId") String departmentId);
}
