package com.procurement.tender.infrastructure;

import com.procurement.tender.domain.Tender;
import com.procurement.tender.domain.TenderAcquisition;
import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface TenderAcquisitionMapper {

  @Insert("""
      insert into tender_acquisitions (id, tenant_id, tender_id, supplier_id, source, acquired_at)
      values (#{id}, #{tenantId}, #{tenderId}, #{supplierId}, #{source}, #{acquiredAt})
      on conflict (tenant_id, tender_id, supplier_id) do nothing
      """)
  int insertIgnore(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("tenderId") String tenderId,
      @Param("supplierId") String supplierId,
      @Param("source") String source,
      @Param("acquiredAt") OffsetDateTime acquiredAt);

  @Select("""
      select id, tenant_id, tender_id, supplier_id, source, acquired_at, created_at
      from tender_acquisitions
      where tenant_id = #{tenantId} and tender_id = #{tenderId}
      order by created_at
      """)
  List<TenderAcquisition> listByTender(@Param("tenantId") String tenantId, @Param("tenderId") String tenderId);

  @Update("""
      update tender_acquisitions set acquired_at = coalesce(acquired_at, #{acquiredAt})
      where tenant_id = #{tenantId} and tender_id = #{tenderId} and supplier_id = #{supplierId}
      """)
  int markAcquired(
      @Param("tenantId") String tenantId,
      @Param("tenderId") String tenderId,
      @Param("supplierId") String supplierId,
      @Param("acquiredAt") OffsetDateTime acquiredAt);

  // 供应商视角:本方被发放/已领取的招标(跨租户按 supplier 维度)。
  @Select("""
      select t.id, t.tenant_id, t.tender_no, t.title, t.tender_type, t.budget, t.status,
             t.document_html, t.evaluation_method, t.bid_bond_amount, t.acquisition_deadline,
             t.submission_deadline, t.opening_at, t.owner_id, t.published_at, t.created_at, t.updated_at, t.opened_at,
             t.awarded_bid_id, t.awarded_at, t.award_notice_html, t.failed_at, t.failure_reason, t.rebid_of_tender_id
      from tenders t
      join tender_acquisitions a on a.tenant_id = t.tenant_id and a.tender_id = t.id
      where a.supplier_id = #{supplierId}
      order by t.created_at desc
      """)
  List<Tender> listTendersBySupplier(@Param("supplierId") String supplierId);

  // 供应商视角:发售中的公开招标(全平台可见,含未领取)。
  @Select("""
      select id, tenant_id, tender_no, title, tender_type, budget, status, document_html,
             evaluation_method, bid_bond_amount, acquisition_deadline, submission_deadline,
             opening_at, owner_id, published_at, created_at, updated_at, opened_at,
             awarded_bid_id, awarded_at, award_notice_html, failed_at, failure_reason, rebid_of_tender_id
      from tenders
      where tender_type = '公开招标' and status = '发售中'
      order by created_at desc
      """)
  List<Tender> listOpenOnSale();

  @Select("""
      select id, tenant_id, tender_id, supplier_id, source, acquired_at, created_at
      from tender_acquisitions
      where supplier_id = #{supplierId}
      """)
  List<TenderAcquisition> listBySupplier(@Param("supplierId") String supplierId);
}
