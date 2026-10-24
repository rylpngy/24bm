package com.procurement.buyer.infrastructure;

import com.procurement.common.data.ProcurementScopeSql;

/** Alias po is deliberately shared by every aggregate to keep filtering identical. */
final class AnalyticsOrderSql {
  private AnalyticsOrderSql() {}

  static final String FILTERED_ORDERS = """
      select po.* from purchase_orders po
      where po.tenant_id = #{tenantId}
        and po.id in (
      """ + ProcurementScopeSql.ORDERS + """
        )
        and po.created_at &gt;= #{filter.startInclusive}
        and po.created_at &lt; #{filter.endExclusive}
        <if test="filter.supplierId != null">and po.supplier_id = #{filter.supplierId}</if>
        <if test="filter.status != null">and po.status = #{filter.status}</if>
      """;
}
