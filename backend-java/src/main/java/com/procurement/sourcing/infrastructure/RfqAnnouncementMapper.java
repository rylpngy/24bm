package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.domain.RfqAnnouncement;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

// 租户内公告读写;公开(跨租户)读取见 PublicProcurementAnnouncementMapper。
@Mapper
public interface RfqAnnouncementMapper {

  @Insert("""
      insert into rfq_announcements (
        id, tenant_id, rfq_id, type, title, summary, method, deadline_at,
        evaluation_method, quote_requirement, delivery_requirement,
        awarded_supplier_name, award_amount, close_reason)
      values (
        #{id}, #{tenantId}, #{rfqId}, #{type}, #{title}, #{summary}, #{method}, #{deadlineAt},
        #{evaluationMethod}, #{quoteRequirement}, #{deliveryRequirement},
        #{awardedSupplierName}, #{awardAmount}, #{closeReason})
      """)
  int insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("type") String type,
      @Param("title") String title,
      @Param("summary") String summary,
      @Param("method") String method,
      @Param("deadlineAt") OffsetDateTime deadlineAt,
      @Param("evaluationMethod") String evaluationMethod,
      @Param("quoteRequirement") String quoteRequirement,
      @Param("deliveryRequirement") String deliveryRequirement,
      @Param("awardedSupplierName") String awardedSupplierName,
      @Param("awardAmount") BigDecimal awardAmount,
      @Param("closeReason") String closeReason);

  @Select("""
      select id, tenant_id, rfq_id, type, title, summary, method, deadline_at,
             evaluation_method, quote_requirement, delivery_requirement,
             awarded_supplier_name, award_amount, close_reason, published_at
        from rfq_announcements
       where tenant_id = #{tenantId} and rfq_id = #{rfqId}
       order by published_at desc
      """)
  List<RfqAnnouncement> listByTenantAndRfq(@Param("tenantId") String tenantId, @Param("rfqId") String rfqId);

  @Select("select name from enterprises where id = #{supplierId}")
  String findSupplierName(@Param("supplierId") String supplierId);
}
