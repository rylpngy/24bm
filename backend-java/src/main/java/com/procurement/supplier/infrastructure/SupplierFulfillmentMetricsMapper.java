package com.procurement.supplier.infrastructure;

import com.procurement.supplier.domain.SupplierFulfillmentMetrics;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

// 供应商实测履约:从收货验收单(join 订单取供应商与预计到货)聚合质量与准时数据。
@Mapper
public interface SupplierFulfillmentMetricsMapper {

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
