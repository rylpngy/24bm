package com.procurement.tender.infrastructure;

import com.procurement.tender.domain.Tender;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface TenderMapper {

  String COLUMNS = """
      id, tenant_id, tender_no, title, tender_type, budget, status, document_html,
      evaluation_method, bid_bond_amount, acquisition_deadline, submission_deadline,
      opening_at, owner_id, published_at, created_at, updated_at, opened_at,
      awarded_bid_id, awarded_at, award_notice_html, failed_at, failure_reason, rebid_of_tender_id,
      execution_order_id, prequalification_required
      """;

  @Insert("""
      insert into tenders (
        id, tenant_id, tender_no, title, tender_type, budget, status, document_html,
        evaluation_method, bid_bond_amount, acquisition_deadline, submission_deadline,
        opening_at, owner_id)
      values (
        #{id}, #{tenantId}, #{tenderNo}, #{title}, #{tenderType}, #{budget}, #{status},
        #{documentHtml}, #{evaluationMethod}, #{bidBondAmount}, #{acquisitionDeadline},
        #{submissionDeadline}, #{openingAt}, #{ownerId})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("tenderNo") String tenderNo,
      @Param("title") String title,
      @Param("tenderType") String tenderType,
      @Param("budget") BigDecimal budget,
      @Param("status") String status,
      @Param("documentHtml") String documentHtml,
      @Param("evaluationMethod") String evaluationMethod,
      @Param("bidBondAmount") BigDecimal bidBondAmount,
      @Param("acquisitionDeadline") OffsetDateTime acquisitionDeadline,
      @Param("submissionDeadline") OffsetDateTime submissionDeadline,
      @Param("openingAt") OffsetDateTime openingAt,
      @Param("ownerId") String ownerId);

  @Select("select " + COLUMNS + " from tenders where tenant_id = #{tenantId} order by created_at desc")
  List<Tender> listByTenant(@Param("tenantId") String tenantId);

  @Select("select " + COLUMNS + " from tenders where tenant_id = #{tenantId} and id = #{id}")
  Tender findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Update("""
      update tenders set title = #{title}, tender_type = #{tenderType}, budget = #{budget},
        document_html = #{documentHtml}, evaluation_method = #{evaluationMethod},
        bid_bond_amount = #{bidBondAmount}, acquisition_deadline = #{acquisitionDeadline},
        submission_deadline = #{submissionDeadline}, opening_at = #{openingAt}, updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int updateDraft(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("title") String title,
      @Param("tenderType") String tenderType,
      @Param("budget") BigDecimal budget,
      @Param("documentHtml") String documentHtml,
      @Param("evaluationMethod") String evaluationMethod,
      @Param("bidBondAmount") BigDecimal bidBondAmount,
      @Param("acquisitionDeadline") OffsetDateTime acquisitionDeadline,
      @Param("submissionDeadline") OffsetDateTime submissionDeadline,
      @Param("openingAt") OffsetDateTime openingAt);

  @Update("""
      update tenders set status = #{status}, published_at = coalesce(published_at, #{publishedAt}),
        updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int updateStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("status") String status,
      @Param("publishedAt") OffsetDateTime publishedAt);

  @Update("""
      update tenders set status = #{status}, opened_at = #{openedAt}, updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int markOpened(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("status") String status,
      @Param("openedAt") OffsetDateTime openedAt);

  @Update("""
      update tenders set status = #{status}, awarded_bid_id = #{awardedBidId},
        awarded_at = #{awardedAt}, award_notice_html = #{awardNoticeHtml}, updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int markAwarded(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("status") String status,
      @Param("awardedBidId") String awardedBidId,
      @Param("awardedAt") OffsetDateTime awardedAt,
      @Param("awardNoticeHtml") String awardNoticeHtml);

  @Update("""
      update tenders set status = #{status}, failed_at = #{failedAt}, failure_reason = #{failureReason},
        updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int markFailed(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("status") String status,
      @Param("failedAt") OffsetDateTime failedAt,
      @Param("failureReason") String failureReason);

  @Update("""
      update tenders set rebid_of_tender_id = #{rebidOfTenderId}, updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int markRebidOf(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("rebidOfTenderId") String rebidOfTenderId);

  @Update("""
      update tenders set execution_order_id = #{executionOrderId}, updated_at = now()
      where tenant_id = #{tenantId} and id = #{id} and execution_order_id is null
      """)
  int markExecuted(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("executionOrderId") String executionOrderId);

  @Update("""
      update tenders set prequalification_required = #{required}, updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int updatePrequalificationRequired(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("required") boolean required);

  @Select("select count(1) from tenders where tenant_id = #{tenantId} and tender_no like #{prefix} || '%'")
  int countByTenantAndNoPrefix(@Param("tenantId") String tenantId, @Param("prefix") String prefix);
}
