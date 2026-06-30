package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.domain.AwardDecision;
import java.math.BigDecimal;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface AwardDecisionMapper {

  @Insert("""
      insert into award_decisions (id, tenant_id, rfq_id, quote_id, supplier_id, amount, reason, approved_status)
      values (#{id}, #{tenantId}, #{rfqId}, #{quoteId}, #{supplierId}, #{amount}, #{reason}, #{approvedStatus})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("quoteId") String quoteId,
      @Param("supplierId") String supplierId,
      @Param("amount") BigDecimal amount,
      @Param("reason") String reason,
      @Param("approvedStatus") String approvedStatus);

  @Select("""
      select id, tenant_id, rfq_id, quote_id, supplier_id, amount, reason, approved_status, created_at
      from award_decisions
      where tenant_id = #{tenantId} and id = #{id}
      """)
  AwardDecision findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, rfq_id, quote_id, supplier_id, amount, reason, approved_status, created_at
      from award_decisions
      where tenant_id = #{tenantId}
        and id = #{id}
        and approved_status = #{approvedStatus}
      """)
  AwardDecision findApprovedForOrder(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("approvedStatus") String approvedStatus);

  // 结果公示:取该 RFQ 已通过的定标决定(中标人)。
  @Select("""
      select id, tenant_id, rfq_id, quote_id, supplier_id, amount, reason, approved_status, created_at
      from award_decisions
      where tenant_id = #{tenantId}
        and rfq_id = #{rfqId}
        and approved_status = #{approvedStatus}
      order by created_at desc
      limit 1
      """)
  AwardDecision findApprovedByRfq(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("approvedStatus") String approvedStatus);

  @Update("""
      update award_decisions
      set approved_status = #{approvedStatus}
      where tenant_id = #{tenantId}
        and id = #{id}
        and approved_status = #{currentApprovedStatus}
      """)
  int updateApprovedStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("currentApprovedStatus") String currentApprovedStatus,
      @Param("approvedStatus") String approvedStatus);
}
