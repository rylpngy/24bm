package com.procurement.buyer.infrastructure;

import com.procurement.buyer.domain.MonthlySpend;
import com.procurement.buyer.domain.StatusSlice;
import com.procurement.buyer.domain.SupplierSpend;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

// 采购分析聚合:均按 tenant_id 限定,口径以采购订单金额为支出基准。
@Mapper
public interface BuyerAnalyticsMapper {

  @Select("""
      select to_char(created_at, 'YYYY-MM') as period,
             coalesce(sum(amount), 0) as total_amount,
             count(*) as order_count
      from purchase_orders
      where tenant_id = #{tenantId}
      group by to_char(created_at, 'YYYY-MM')
      order by period asc
      """)
  List<MonthlySpend> monthlySpend(@Param("tenantId") String tenantId);

  @Select("""
      select po.supplier_id as supplier_id,
             coalesce(e.name, po.supplier_id) as supplier_name,
             coalesce(sum(po.amount), 0) as total_amount,
             count(*) as order_count
      from purchase_orders po
      left join enterprises e on e.id = po.supplier_id
      where po.tenant_id = #{tenantId}
      group by po.supplier_id, e.name
      order by total_amount desc
      """)
  List<SupplierSpend> supplierSpend(@Param("tenantId") String tenantId);

  @Select("""
      select status,
             count(*) as order_count,
             coalesce(sum(amount), 0) as total_amount
      from purchase_orders
      where tenant_id = #{tenantId}
      group by status
      order by total_amount desc
      """)
  List<StatusSlice> statusDistribution(@Param("tenantId") String tenantId);

  // 比价节支:各已定标 RFQ(最高报价 − 中标金额)之和。
  @Select("""
      select coalesce(sum(mq.max_amount - ad.amount), 0)
      from award_decisions ad
      join (select rfq_id, max(amount) as max_amount from quotes group by rfq_id) mq
        on mq.rfq_id = ad.rfq_id
      where ad.tenant_id = #{tenantId}
      """)
  BigDecimal biddingSavings(@Param("tenantId") String tenantId);

  // 品类支出:已通过需求的行项按物料分类聚合(估算口径:参考价 × 数量)。
  @org.apache.ibatis.annotations.Select("""
      select coalesce(m.category, '其他') as category,
             sum(m.reference_price * pdi.quantity) as total_amount
      from purchase_demand_items pdi
      join purchase_demands pd on pd.id = pdi.demand_id and pd.tenant_id = pdi.tenant_id
      join materials m on m.id = pdi.material_id and m.tenant_id = pdi.tenant_id
      where pdi.tenant_id = #{tenantId}
        and pd.status = '已通过'
      group by coalesce(m.category, '其他')
      order by total_amount desc
      """)
  java.util.List<com.procurement.buyer.domain.CategorySpend> categorySpend(
      @org.apache.ibatis.annotations.Param("tenantId") String tenantId);
}
