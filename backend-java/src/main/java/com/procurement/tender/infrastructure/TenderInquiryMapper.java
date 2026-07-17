package com.procurement.tender.infrastructure;

import com.procurement.tender.domain.TenderInquiry;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface TenderInquiryMapper {

  String COLUMNS = """
      id, tenant_id, tender_id, bid_id, kind, question, asked_at, answer, revised_amount, answered_at
      """;

  @Insert("""
      insert into tender_inquiries (id, tenant_id, tender_id, bid_id, kind, question)
      values (#{id}, #{tenantId}, #{tenderId}, #{bidId}, #{kind}, #{question})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("tenderId") String tenderId,
      @Param("bidId") String bidId,
      @Param("kind") String kind,
      @Param("question") String question);

  // 答复一次:answered_at 空档才允许写入。
  @Update("""
      update tender_inquiries set answer = #{answer}, revised_amount = #{revisedAmount},
        answered_at = #{answeredAt}
      where id = #{id} and tenant_id = #{tenantId} and answered_at is null
      """)
  int answer(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("answer") String answer,
      @Param("revisedAmount") BigDecimal revisedAmount,
      @Param("answeredAt") OffsetDateTime answeredAt);

  @Select("select " + COLUMNS + " from tender_inquiries where tenant_id = #{tenantId} and tender_id = #{tenderId} order by asked_at, id")
  List<TenderInquiry> listByTender(@Param("tenantId") String tenantId, @Param("tenderId") String tenderId);
}
