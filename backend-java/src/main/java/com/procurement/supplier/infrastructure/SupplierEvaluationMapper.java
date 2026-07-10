package com.procurement.supplier.infrastructure;

import com.procurement.supplier.domain.SupplierEvaluation;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SupplierEvaluationMapper {

  @Insert("""
      insert into supplier_evaluations (
        id, tenant_id, supplier_id, period,
        quality_score, delivery_score, price_score, service_score,
        total_score, suggested_tier, comment, evaluated_by
      ) values (
        #{id}, #{tenantId}, #{supplierId}, #{period},
        #{qualityScore}, #{deliveryScore}, #{priceScore}, #{serviceScore},
        #{totalScore}, #{suggestedTier}, #{comment}, #{evaluatedBy}
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
      @Param("evaluatedBy") String evaluatedBy);

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

  @Select("""
      select count(*) from supplier_evaluations
      where tenant_id = #{tenantId} and supplier_id = #{supplierId} and period = #{period}
      """)
  int countByPeriod(
      @Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId,
      @Param("period") String period);
}
