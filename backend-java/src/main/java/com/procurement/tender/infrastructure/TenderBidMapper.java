package com.procurement.tender.infrastructure;

import com.procurement.tender.domain.TenderBid;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface TenderBidMapper {

  String COLUMNS = """
      id, tenant_id, tender_id, supplier_id, bid_amount, document_html, content_digest,
      sealed_status, submitted_at, withdrawn_at
      """;

  // 递交/重投:每家一行,冲突时覆盖为新密封(新内容+新指纹+新时间,清撤回痕)。
  @Insert("""
      insert into tender_bids (
        id, tenant_id, tender_id, supplier_id, bid_amount, document_html, content_digest,
        sealed_status, submitted_at)
      values (
        #{id}, #{tenantId}, #{tenderId}, #{supplierId}, #{bidAmount}, #{documentHtml},
        #{contentDigest}, '已密封', #{submittedAt})
      on conflict (tenant_id, tender_id, supplier_id) do update set
        bid_amount = excluded.bid_amount,
        document_html = excluded.document_html,
        content_digest = excluded.content_digest,
        sealed_status = '已密封',
        submitted_at = excluded.submitted_at,
        withdrawn_at = null
      """)
  void upsert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("tenderId") String tenderId,
      @Param("supplierId") String supplierId,
      @Param("bidAmount") BigDecimal bidAmount,
      @Param("documentHtml") String documentHtml,
      @Param("contentDigest") String contentDigest,
      @Param("submittedAt") OffsetDateTime submittedAt);

  @Update("""
      update tender_bids set sealed_status = '已撤回', withdrawn_at = #{withdrawnAt}
      where tenant_id = #{tenantId} and tender_id = #{tenderId} and supplier_id = #{supplierId}
      """)
  int withdraw(
      @Param("tenantId") String tenantId,
      @Param("tenderId") String tenderId,
      @Param("supplierId") String supplierId,
      @Param("withdrawnAt") OffsetDateTime withdrawnAt);

  // 开标解封:在案密封投标批量转「已开启」;已撤回的保持撤回留痕不解封。
  @Update("""
      update tender_bids set sealed_status = '已开启'
      where tenant_id = #{tenantId} and tender_id = #{tenderId} and sealed_status = '已密封'
      """)
  int markAllOpened(@Param("tenantId") String tenantId, @Param("tenderId") String tenderId);

  @Select("select " + COLUMNS + " from tender_bids where tenant_id = #{tenantId} and tender_id = #{tenderId} order by submitted_at")
  List<TenderBid> listByTender(@Param("tenantId") String tenantId, @Param("tenderId") String tenderId);

  @Select("select " + COLUMNS + " from tender_bids where supplier_id = #{supplierId}")
  List<TenderBid> listBySupplier(@Param("supplierId") String supplierId);
}
