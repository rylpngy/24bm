package com.procurement.supplier.infrastructure;

import com.procurement.supplier.domain.SupplierEvaluation;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Options;

@Mapper
public interface SupplierEvaluationMapper {

  // Serialize task reservations and free-form evaluations for the same buyer/supplier relation.
  @Select("select id from buyer_supplier_relations where tenant_id=#{tenantId} and id=#{relationId} for update")
  @Options(flushCache = Options.FlushCachePolicy.TRUE)
  String lockRelation(@Param("tenantId") String tenantId, @Param("relationId") String relationId);

  @Select("""
      select id from supplier_performance_tasks
      where tenant_id=#{tenantId} and supplier_id=#{supplierId} and period=#{period}
        and status='assigned'
      """)
  String assignedTaskId(@Param("tenantId") String tenantId, @Param("supplierId") String supplierId,
      @Param("period") String period);

  @Select("""
      select count(*) from supplier_evaluations
      where tenant_id=#{tenantId} and supplier_id=#{supplierId} and upper(btrim(period, #{whitespace}))=#{period}
      """)
  int countNormalizedPeriod(@Param("tenantId") String tenantId, @Param("supplierId") String supplierId,
      @Param("period") String period, @Param("whitespace") String whitespace);

  @Insert("""
      insert into supplier_evaluations (
        id, tenant_id, supplier_id, period,
        quality_score, delivery_score, price_score, service_score,
        total_score, suggested_tier, comment, evaluated_by, scoring_snapshot
      ) values (
        #{id}, #{tenantId}, #{supplierId}, #{period},
        #{qualityScore}, #{deliveryScore}, #{priceScore}, #{serviceScore},
        #{totalScore}, #{suggestedTier}, #{comment}, #{evaluatedBy}, cast(#{scoringSnapshot} as jsonb)
      )
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId,
      @Param("period") String period,
      @Param("qualityScore") BigDecimal qualityScore,
      @Param("deliveryScore") BigDecimal deliveryScore,
      @Param("priceScore") BigDecimal priceScore,
      @Param("serviceScore") BigDecimal serviceScore,
      @Param("totalScore") BigDecimal totalScore,
      @Param("suggestedTier") String suggestedTier,
      @Param("comment") String comment,
      @Param("evaluatedBy") String evaluatedBy,
      @Param("scoringSnapshot") String scoringSnapshot);

  @Select("select scoring_snapshot::text from supplier_evaluations where tenant_id=#{tenantId} and id=#{id}")
  String scoringSnapshot(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("select template_version_id from supplier_performance_tasks where tenant_id=#{tenantId} and id=#{taskId}")
  String taskTemplateVersionId(@Param("tenantId") String tenantId, @Param("taskId") String taskId);

  @Select("""
      select id, tenant_id, supplier_id, period,
             quality_score, delivery_score, price_score, service_score,
             total_score, suggested_tier, comment, evaluated_by, created_at
      from supplier_evaluations
      where tenant_id = #{tenantId} and supplier_id = #{supplierId}
      order by created_at desc
      """)
  List<SupplierEvaluation> listBySupplier(
      @Param("tenantId") String tenantId, @Param("supplierId") String supplierId);

}
