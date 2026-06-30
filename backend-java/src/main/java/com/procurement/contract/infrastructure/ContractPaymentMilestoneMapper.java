package com.procurement.contract.infrastructure;

import com.procurement.contract.domain.ContractPaymentMilestone;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ContractPaymentMilestoneMapper {

  @Insert("""
      insert into contract_payment_milestones
        (id, tenant_id, contract_id, name, percent, amount, status, sort_no)
      values
        (#{id}, #{tenantId}, #{contractId}, #{name}, #{percent}, #{amount}, #{status}, #{sortNo})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId,
      @Param("name") String name,
      @Param("percent") int percent,
      @Param("amount") BigDecimal amount,
      @Param("status") String status,
      @Param("sortNo") int sortNo);

  @Select("""
      select id, tenant_id, contract_id, name, percent, amount, status, sort_no, paid_at, reached, reached_at
      from contract_payment_milestones
      where tenant_id = #{tenantId} and contract_id = #{contractId}
      order by sort_no asc
      """)
  List<ContractPaymentMilestone> listByContract(
      @Param("tenantId") String tenantId, @Param("contractId") String contractId);

  @Select("""
      select count(1) from contract_payment_milestones
      where tenant_id = #{tenantId} and contract_id = #{contractId}
      """)
  int countByContract(@Param("tenantId") String tenantId, @Param("contractId") String contractId);

  // 付款须先达成:reached=true 才允许 待付 → 已付。
  @Update("""
      update contract_payment_milestones
      set status = #{toStatus}, paid_at = now()
      where tenant_id = #{tenantId} and id = #{id} and status = #{fromStatus} and reached = true
      """)
  int markPaid(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("fromStatus") String fromStatus,
      @Param("toStatus") String toStatus);

  // 达成确认:未达成 → 达成。
  @Update("""
      update contract_payment_milestones
      set reached = true, reached_at = now()
      where tenant_id = #{tenantId} and id = #{id} and reached = false
      """)
  int markReached(@Param("tenantId") String tenantId, @Param("id") String id);
}
