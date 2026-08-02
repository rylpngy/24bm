package com.procurement.platform.infrastructure;

import com.procurement.platform.api.PlatformBusinessMetricsResponse.MethodShare;
import com.procurement.platform.api.PlatformBusinessMetricsResponse.MonthlyTrend;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

/**
 * 平台经营指标:跨租户只读聚合(平台运营端专用,已登记 TenantIsolationArchitectureTests 白名单)。
 * 仅返回聚合数值,不下发任何租户明细业务字段。
 */
@Mapper
public interface PlatformMetricsMapper {

  @Select("select count(1) from purchase_orders")
  long countOrders();

  @Select("select coalesce(sum(amount), 0) from purchase_orders")
  BigDecimal sumOrderAmount();

  @Select("select count(1) from contracts")
  long countContracts();

  @Select("select coalesce(sum(amount), 0) from contracts")
  BigDecimal sumContractAmount();

  @Select("select count(1) from purchase_orders where created_at >= now() - interval '30 days'")
  long countRecentOrders();

  @Select("select coalesce(sum(amount), 0) from purchase_orders where created_at >= now() - interval '30 days'")
  BigDecimal sumRecentOrderAmount();

  // 活跃租户:近 30 天有下单或立项动作。
  @Select("""
      select count(distinct tenant_id) from (
        select tenant_id from purchase_orders where created_at >= now() - interval '30 days'
        union all
        select tenant_id from rfqs where created_at >= now() - interval '30 days'
        union all
        select tenant_id from tenders where created_at >= now() - interval '30 days'
      ) active
      """)
  long countActiveTenants();

  @Select("select count(1) from enterprises where type = 'supplier' and verified = true")
  long countVerifiedSuppliers();

  @Select("""
      select count(1) from enterprises
      where type = 'supplier' and created_at >= now() - interval '30 days'
      """)
  long countRecentSuppliers();

  // 采购方式分布:项目数与经该方式成交的订单额(招标经锚点 RFQ 归入「招标」)。
  @Select("""
      select coalesce(r.method, '询比') as method,
             count(distinct r.id) as projectCount,
             coalesce(sum(po.amount), 0) as orderAmount
      from rfqs r
      left join purchase_orders po on po.rfq_id = r.id and po.tenant_id = r.tenant_id
      group by coalesce(r.method, '询比')
      order by count(distinct r.id) desc
      """)
  List<MethodShare> listMethodShares();

  // 近 6 个月趋势:订单笔数/金额与新增租户。
  @Select("""
      with months as (
        select to_char(date_trunc('month', now()) - (n || ' month')::interval, 'YYYY-MM') as month,
               date_trunc('month', now()) - (n || ' month')::interval as start_at,
               date_trunc('month', now()) - ((n - 1) || ' month')::interval as end_at
        from generate_series(5, 0, -1) as n
      )
      select m.month,
             (select count(1) from purchase_orders po
               where po.created_at >= m.start_at and po.created_at < m.end_at) as orderCount,
             (select coalesce(sum(po.amount), 0) from purchase_orders po
               where po.created_at >= m.start_at and po.created_at < m.end_at) as orderAmount,
             (select count(1) from tenants t
               where t.created_at >= m.start_at and t.created_at < m.end_at) as newTenantCount
      from months m
      order by m.month
      """)
  List<MonthlyTrend> listMonthlyTrends();
}
