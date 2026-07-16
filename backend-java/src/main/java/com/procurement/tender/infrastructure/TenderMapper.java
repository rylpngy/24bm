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
      opening_at, owner_id, published_at, created_at, updated_at
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

  @Select("select count(1) from tenders where tenant_id = #{tenantId} and tender_no like #{prefix} || '%'")
  int countByTenantAndNoPrefix(@Param("tenantId") String tenantId, @Param("prefix") String prefix);
}
