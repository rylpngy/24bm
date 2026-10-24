package com.procurement.supplier.infrastructure;

import com.procurement.identity.domain.DataScope;
import com.procurement.supplier.api.SupplierPerformanceComparisonResponse;
import com.procurement.supplier.domain.SupplierEvaluationPeriod;
import com.procurement.supplier.domain.SupplierFulfillmentMetrics;
import com.procurement.supplier.domain.SupplierPerformancePeriod;
import com.procurement.supplier.domain.SupplierPeriodMetrics;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

// 供应商实测履约:从收货验收单(join 订单取供应商与预计到货)聚合质量与准时数据。
@Mapper
public interface SupplierFulfillmentMetricsMapper {
  @Select("<script>" + """
      select distinct po.id from receipts r
      join purchase_orders po on po.id=r.order_id and po.tenant_id=r.tenant_id
      where r.tenant_id=#{tenantId} and po.supplier_id=#{supplierId}
      and po.id in (
      """ + com.procurement.common.data.ProcurementScopeSql.ORDERS + """
      ) order by po.id limit 201
      </script>
      """)
  List<String> aiReceiptOrderIds(@Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId,@Param("scope") DataScope scope);

  @Select("<script>" + SupplierPeriodMetricsSql.CTE + """
      select receipt_count, on_time_count, total_received, total_qualified,
        scheduled_receipt_count, on_time_rate, qualified_rate
      from metrics
      </script>
      """)
  SupplierPeriodMetrics aggregatePeriod(@Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId, @Param("period") SupplierPerformancePeriod period,
      @Param("scope") DataScope scope);

  default List<SupplierPerformanceComparisonResponse> compare(
      String tenantId, SupplierPerformancePeriod period, DataScope scope) {
    return comparePeriod(tenantId, null, period, scope, SupplierEvaluationPeriod.STRIP_CHARACTERS);
  }

  @Select("<script>" + SupplierPeriodMetricsSql.CTE + """
      , period_evaluations as (
        select distinct on (supplier_id) supplier_id, id, quality_score, delivery_score,
          price_score, service_score, total_score, created_at
        from supplier_evaluations
        where tenant_id = #{tenantId} and upper(btrim(period, #{whitespace})) = #{period.period}
        order by supplier_id, created_at desc, id
      )
      select rel.id as relation_id, rel.supplier_id, e.name as supplier_name,
        rel.status, rel.level, rel.cooperation_tier,
        ev.id as evaluation_id, ev.quality_score, ev.delivery_score, ev.price_score,
        ev.service_score, ev.total_score, ev.created_at as evaluated_at,
        coalesce(m.receipt_count, 0) as receipt_count,
        coalesce(m.on_time_count, 0) as on_time_count, m.on_time_rate,
        coalesce(m.total_received, 0) as total_received,
        coalesce(m.total_qualified, 0) as total_qualified, m.qualified_rate,
        coalesce(m.scheduled_receipt_count, 0) as scheduled_receipt_count
      from buyer_supplier_relations rel
      join enterprises e on e.id = rel.supplier_id
      left join period_evaluations ev on ev.supplier_id = rel.supplier_id
      left join metrics m on m.supplier_id = rel.supplier_id
      where rel.tenant_id = #{tenantId}
      order by rel.id
      </script>
      """)
  List<SupplierPerformanceComparisonResponse> comparePeriod(@Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId, @Param("period") SupplierPerformancePeriod period,
      @Param("scope") DataScope scope, @Param("whitespace") String whitespace);

  @Select("""
      select count(*) as receipt_count,
             coalesce(sum(case when r.received_at::date <= po.expected_receipt_date then 1 else 0 end), 0)
               as on_time_count,
             coalesce(sum(r.received_quantity), 0) as total_received,
             coalesce(sum(r.qualified_quantity), 0) as total_qualified
      from receipts r
      join purchase_orders po on po.id = r.order_id and po.tenant_id = r.tenant_id
      where r.tenant_id = #{tenantId} and po.supplier_id = #{supplierId}
      """)
  SupplierFulfillmentMetrics aggregate(
      @Param("tenantId") String tenantId, @Param("supplierId") String supplierId);
}
