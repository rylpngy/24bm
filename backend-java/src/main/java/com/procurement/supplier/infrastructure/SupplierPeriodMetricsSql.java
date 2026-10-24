package com.procurement.supplier.infrastructure;

import com.procurement.common.data.ProcurementScopeSql;

/** Both views share registration-time boundaries, order visibility and rate denominators. */
final class SupplierPeriodMetricsSql {
  private SupplierPeriodMetricsSql() {}

  static final String CTE = """
      with receipt_totals as (
        select po.supplier_id,
          count(*)::integer as receipt_count,
          count(po.expected_receipt_date)::integer as scheduled_receipt_count,
          count(*) filter (where (r.received_at at time zone 'Asia/Shanghai')::date
            &lt;= po.expected_receipt_date)::integer as on_time_count,
          coalesce(sum(r.received_quantity), 0) as total_received,
          coalesce(sum(r.qualified_quantity), 0) as total_qualified
        from receipts r
        join purchase_orders po on po.id = r.order_id and po.tenant_id = r.tenant_id
        where r.tenant_id = #{tenantId}
        <if test="supplierId != null">and po.supplier_id = #{supplierId}</if>
        <if test="period != null">
          and r.received_at &gt;= #{period.startAt}
          and r.received_at &lt; #{period.endAt}
        </if>
        and po.id in (
      """ + ProcurementScopeSql.ORDERS + """
        )
        group by po.supplier_id
      ), metrics as (
        select *,
          round(on_time_count * 100.0 / nullif(scheduled_receipt_count, 0))::integer as on_time_rate,
          round(total_qualified * 100.0 / nullif(total_received, 0))::integer as qualified_rate
        from receipt_totals
      )
      """;
}
