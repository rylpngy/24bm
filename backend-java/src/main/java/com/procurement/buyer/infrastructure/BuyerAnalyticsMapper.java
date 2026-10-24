package com.procurement.buyer.infrastructure;

import com.procurement.buyer.domain.MonthlySpend;
import com.procurement.buyer.domain.StatusSlice;
import com.procurement.buyer.domain.SupplierSpend;
import com.procurement.buyer.domain.ProcurementAnalyticsFilter;
import com.procurement.common.data.ProcurementScopeSql;
import com.procurement.identity.domain.DataScope;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

// 订单金额不代表付款；需求估算是独立总体，不与订单金额对账。
@Mapper
public interface BuyerAnalyticsMapper {
  @Select("""
      <script>with filtered_orders as (
      """ + AnalyticsOrderSql.FILTERED_ORDERS + """
      ) select to_char(created_at at time zone 'Asia/Shanghai', 'YYYY-MM') as period,
             coalesce(sum(amount), 0) as total_amount,
             count(*) as order_count
      from filtered_orders
      group by to_char(created_at at time zone 'Asia/Shanghai', 'YYYY-MM')
      order by period asc</script>
      """)
  List<MonthlySpend> monthlySpend(@Param("tenantId") String tenantId, @Param("scope") DataScope scope,
      @Param("filter") ProcurementAnalyticsFilter filter);

  @Select("""
      <script>with filtered_orders as (
      """ + AnalyticsOrderSql.FILTERED_ORDERS + """
      ) select po.supplier_id as supplier_id,
             coalesce(e.name, po.supplier_id) as supplier_name,
             coalesce(sum(po.amount), 0) as total_amount,
             count(*) as order_count
      from filtered_orders po
      left join enterprises e on e.id = po.supplier_id
      group by po.supplier_id, e.name
      order by total_amount desc, po.supplier_id</script>
      """)
  List<SupplierSpend> supplierSpend(@Param("tenantId") String tenantId, @Param("scope") DataScope scope,
      @Param("filter") ProcurementAnalyticsFilter filter);

  @Select("""
      <script>with filtered_orders as (
      """ + AnalyticsOrderSql.FILTERED_ORDERS + """
      ) select status,
             count(*) as order_count,
             coalesce(sum(amount), 0) as total_amount
      from filtered_orders
      group by status
      order by total_amount desc, status</script>
      """)
  List<StatusSlice> statusDistribution(@Param("tenantId") String tenantId, @Param("scope") DataScope scope,
      @Param("filter") ProcurementAnalyticsFilter filter);

  // 兼容字段名 biddingSavings；实际为筛选订单对应当前有效定标的最高可比报价差额。
  @Select("""
      <script>with filtered_orders as (
      """ + AnalyticsOrderSql.FILTERED_ORDERS + """
      ), effective_awards as (
        select distinct on (ad.rfq_id) ad.rfq_id, ad.amount, r.current_round
        from award_decisions ad
        join rfqs r on r.id = ad.rfq_id and r.tenant_id = ad.tenant_id
        join quotes winner on winner.id = ad.quote_id and winner.tenant_id = ad.tenant_id
          and winner.rfq_id = ad.rfq_id and winner.supplier_id = ad.supplier_id
          and winner.round = r.current_round and winner.status = '已中选'
        where ad.tenant_id = #{tenantId} and ad.approved_status = '已通过'
          and r.status = '已定标' and r.awarded_supplier_id = ad.supplier_id
          and exists (select 1 from filtered_orders po where po.rfq_id = ad.rfq_id and po.supplier_id = ad.supplier_id)
        order by ad.rfq_id, ad.created_at desc, ad.id desc
      ) select coalesce(sum(greatest(comparable.max_amount - a.amount, 0)), 0)
      from effective_awards a
      join lateral (
        select max(q.amount) as max_amount from quotes q
        where q.tenant_id = #{tenantId} and q.rfq_id = a.rfq_id and q.round = a.current_round
          and q.status in ('已提交', '已中选', '未中选') and q.amount &gt; 0
        having count(distinct q.supplier_id) &gt;= 2
      ) comparable on true</script>
      """)
  BigDecimal biddingSavings(@Param("tenantId") String tenantId, @Param("scope") DataScope scope,
      @Param("filter") ProcurementAnalyticsFilter filter);

  // 品类支出:已通过需求的行项按物料分类聚合(估算口径:参考价 × 数量)。
  @org.apache.ibatis.annotations.Select("""
      <script>select coalesce(m.category, '其他') as category,
             coalesce(sum(m.reference_price * pdi.quantity), 0) as total_amount
      from purchase_demand_items pdi
      join purchase_demands pd on pd.id = pdi.demand_id and pd.tenant_id = pdi.tenant_id
      join materials m on m.id = pdi.material_id and m.tenant_id = pdi.tenant_id
      where pdi.tenant_id = #{tenantId}
        and pd.status = '已通过'
        and pd.created_at &gt;= #{filter.startInclusive}
        and pd.created_at &lt; #{filter.endExclusive}
        <if test="scope.restricted">
          <choose>
            <when test="scope.requesterId != null">and pd.requester_id = #{scope.requesterId}</when>
            <when test="scope.departmentIds != null and !scope.departmentIds.isEmpty()">
              and pd.department_id in
              <foreach collection="scope.departmentIds" item="dept" open="(" separator="," close=")">#{dept}</foreach>
            </when>
            <otherwise>and false</otherwise>
          </choose>
        </if>
      group by coalesce(m.category, '其他')
      order by total_amount desc, category</script>
      """)
  java.util.List<com.procurement.buyer.domain.CategorySpend> categorySpend(
      @Param("tenantId") String tenantId, @Param("scope") DataScope scope,
      @Param("filter") ProcurementAnalyticsFilter filter);
}
