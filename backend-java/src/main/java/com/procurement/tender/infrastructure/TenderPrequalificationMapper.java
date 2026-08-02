package com.procurement.tender.infrastructure;

import com.procurement.tender.domain.TenderPrequalification;
import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface TenderPrequalificationMapper {

  String COLUMNS = """
      id, tenant_id, tender_id, supplier_id, application, status, review_comment,
      applied_at, reviewed_at
      """;

  // 重新申请:驳回后覆盖为新的待审查申请(保留同一行,便于追溯最新结论)。
  @Insert("""
      insert into tender_prequalifications
        (id, tenant_id, tender_id, supplier_id, application, status, applied_at)
      values (#{id}, #{tenantId}, #{tenderId}, #{supplierId}, #{application}, '待审查', #{appliedAt})
      on conflict (tenant_id, tender_id, supplier_id) do update set
        application = excluded.application,
        status = '待审查',
        review_comment = null,
        applied_at = excluded.applied_at,
        reviewed_at = null
      """)
  void upsert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("tenderId") String tenderId,
      @Param("supplierId") String supplierId,
      @Param("application") String application,
      @Param("appliedAt") OffsetDateTime appliedAt);

  @Update("""
      update tender_prequalifications
         set status = #{status}, review_comment = #{reviewComment}, reviewed_at = #{reviewedAt}
       where tenant_id = #{tenantId} and id = #{id} and status = '待审查'
      """)
  int review(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("status") String status,
      @Param("reviewComment") String reviewComment,
      @Param("reviewedAt") OffsetDateTime reviewedAt);

  @Select("select " + COLUMNS + " from tender_prequalifications where tenant_id = #{tenantId} and tender_id = #{tenderId} order by applied_at")
  List<TenderPrequalification> listByTender(
      @Param("tenantId") String tenantId, @Param("tenderId") String tenderId);

  @Select("select " + COLUMNS + " from tender_prequalifications where supplier_id = #{supplierId}")
  List<TenderPrequalification> listBySupplier(@Param("supplierId") String supplierId);
}
