package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.domain.AwardDecision;
import java.math.BigDecimal;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
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
  @Results(id = "awardDecisionResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "rfq_id", property = "rfqId"),
      @Result(column = "quote_id", property = "quoteId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "approved_status", property = "approvedStatus"),
      @Result(column = "created_at", property = "createdAt")
  })
  AwardDecision findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, rfq_id, quote_id, supplier_id, amount, reason, approved_status, created_at
      from award_decisions
      where tenant_id = #{tenantId}
        and id = #{id}
        and approved_status = #{approvedStatus}
      """)
  @Results(id = "approvedAwardForOrderResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "rfq_id", property = "rfqId"),
      @Result(column = "quote_id", property = "quoteId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "approved_status", property = "approvedStatus"),
      @Result(column = "created_at", property = "createdAt")
  })
  AwardDecision findApprovedForOrder(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
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
