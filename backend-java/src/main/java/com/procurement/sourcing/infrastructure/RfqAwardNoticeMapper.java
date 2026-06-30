package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.domain.RfqAwardNotice;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface RfqAwardNoticeMapper {

  @Select("""
      select rfq_id, tenant_id, award_id, seal_no, issued_by, issued_at
      from rfq_award_notices
      where tenant_id = #{tenantId} and rfq_id = #{rfqId}
      """)
  RfqAwardNotice findByTenantAndRfq(
      @Param("tenantId") String tenantId, @Param("rfqId") String rfqId);

  @Insert("""
      insert into rfq_award_notices (rfq_id, tenant_id, award_id, seal_no, issued_by)
      values (#{rfqId}, #{tenantId}, #{awardId}, #{sealNo}, #{issuedBy})
      on conflict (rfq_id) do nothing
      """)
  void insert(
      @Param("rfqId") String rfqId,
      @Param("tenantId") String tenantId,
      @Param("awardId") String awardId,
      @Param("sealNo") String sealNo,
      @Param("issuedBy") String issuedBy);
}
