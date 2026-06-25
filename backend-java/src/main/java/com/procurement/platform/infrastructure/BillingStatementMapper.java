package com.procurement.platform.infrastructure;

import com.procurement.platform.domain.BillingStatement;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface BillingStatementMapper {

  @Insert("""
      insert into billing_statements
        (id, tenant_id, period, plan_code, base_price, overage_total, total_amount, status)
      values
        (#{id}, #{tenantId}, #{period}, #{planCode}, #{basePrice}, #{overageTotal},
         #{totalAmount}, #{status})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("period") String period,
      @Param("planCode") String planCode,
      @Param("basePrice") BigDecimal basePrice,
      @Param("overageTotal") BigDecimal overageTotal,
      @Param("totalAmount") BigDecimal totalAmount,
      @Param("status") String status);

  @Select("""
      select id, tenant_id, period, plan_code, base_price, overage_total, total_amount,
             status, generated_at, issued_at, paid_at
      from billing_statements
      where tenant_id = #{tenantId} and period = #{period}
      """)
  BillingStatement findByTenantAndPeriod(
      @Param("tenantId") String tenantId, @Param("period") String period);

  @Select("""
      select id, tenant_id, period, plan_code, base_price, overage_total, total_amount,
             status, generated_at, issued_at, paid_at
      from billing_statements
      where tenant_id = #{tenantId} and id = #{id}
      """)
  BillingStatement findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, period, plan_code, base_price, overage_total, total_amount,
             status, generated_at, issued_at, paid_at
      from billing_statements
      where tenant_id = #{tenantId}
      order by period desc, generated_at desc
      """)
  List<BillingStatement> listByTenant(@Param("tenantId") String tenantId);

  // 开票:草稿 → 已开票(置 issued_at)。
  @Update("""
      update billing_statements
      set status = #{toStatus}, issued_at = now()
      where tenant_id = #{tenantId} and id = #{id} and status = #{fromStatus}
      """)
  int markIssued(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("fromStatus") String fromStatus,
      @Param("toStatus") String toStatus);

  // 收款:已开票 → 已结清(置 paid_at)。
  @Update("""
      update billing_statements
      set status = #{toStatus}, paid_at = now()
      where tenant_id = #{tenantId} and id = #{id} and status = #{fromStatus}
      """)
  int markPaid(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("fromStatus") String fromStatus,
      @Param("toStatus") String toStatus);
}
