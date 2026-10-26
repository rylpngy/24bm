package com.procurement.order.infrastructure;

import com.procurement.order.api.OrderCancellationContracts.Entry;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface OrderCancellationMapper {
  String ROW =
      "select"
          + " id,order_id,status,reason,previous_status,created_by,created_at,completed_by,completed_at,response"
          + " from order_cancellation_requests ";

  @Select(
      ROW
          + "where tenant_id=#{t} and order_id=#{o} order by created_at desc,id limit #{s} offset"
          + " #{offset}")
  List<Entry> page(
      @Param("t") String t, @Param("o") String o, @Param("s") int s, @Param("offset") long offset);

  @Select("select count(*) from order_cancellation_requests where tenant_id=#{t} and order_id=#{o}")
  long count(@Param("t") String t, @Param("o") String o);

  @Select(ROW + "where tenant_id=#{t} and order_id=#{o} and id=#{id}")
  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  Entry find(@Param("t") String t, @Param("o") String o, @Param("id") String id);

  @Select(ROW + "where tenant_id=#{t} and order_id=#{o} and request_key=#{key}")
  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  Entry byKey(@Param("t") String t, @Param("o") String o, @Param("key") String key);

  @Select(
      """
select reason from (
 select '已有关联合同，请先按合同解约流程处理' reason where exists(select 1 from contracts where tenant_id=#{t} and related_order_id=#{o})
 union all select '历史商城扣库依据缺失，须先核对原始库存责任' where exists(select 1 from order_line_items where tenant_id=#{t} and order_id=#{o} and source_sku_id is not null and reserved_stock_qty is null)
union all select '已有发货或收货记录，不能按未履行订单取消' where exists(select 1 from deliveries where tenant_id=#{t} and order_id=#{o}) or exists(select 1 from receipts where tenant_id=#{t} and order_id=#{o})
union all select '已有发票或付款责任，须先走清算流程' where exists(select 1 from invoices where tenant_id=#{t} and order_id=#{o})
union all select '存在售后记录，须先核对责任' where exists(select 1 from mall_after_sales where tenant_id=#{t} and order_id=#{o})
union all select '项目已归档或正在办理变更/承接清算' where exists(
select 1 from purchase_orders o join rfq_demands rd on rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id
join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id
join procurement_projects p on p.tenant_id=d.tenant_id and p.id=d.project_id
where o.tenant_id=#{t} and o.id=#{o} and (p.status<>'approved'
or exists(select 1 from procurement_project_lifecycle_requests r where r.tenant_id=p.tenant_id and r.project_id=p.id and r.status='submitted')
or exists(select 1 from procurement_project_changes c where c.tenant_id=p.tenant_id and c.project_id=p.id and c.status='submitted')))
union all select '采购执行已归档，不能直接取消' where exists(select 1 from procurement_execution_archives a join purchase_orders o on o.tenant_id=a.tenant_id and o.rfq_id=a.rfq_id where o.tenant_id=#{t} and o.id=#{o})
) b order by reason
""")
  List<String> blockers(@Param("t") String t, @Param("o") String o);

  @Insert(
      "insert into"
          + " order_cancellation_requests(id,tenant_id,order_id,supplier_id,request_key,reason,previous_status,status,created_by)"
          + " values(#{id},#{t},#{o},#{supplier},#{key},#{reason},#{previous},'pending',#{actor})")
  void insert(
      @Param("id") String id,
      @Param("t") String t,
      @Param("o") String o,
      @Param("supplier") String supplier,
      @Param("key") String key,
      @Param("reason") String reason,
      @Param("previous") String previous,
      @Param("actor") String actor);

  @Update(
      "update order_cancellation_requests set"
          + " status=#{status},response=#{reason},completed_by=#{actor},completed_at=now() where"
          + " tenant_id=#{t} and order_id=#{o} and id=#{id} and status='pending'")
  int finish(
      @Param("t") String t,
      @Param("o") String o,
      @Param("id") String id,
      @Param("status") String status,
      @Param("reason") String reason,
      @Param("actor") String actor);

  @Select(
      "select source_sku_id from order_line_items where tenant_id=#{t} and order_id=#{o} and"
          + " source_sku_id is not null and reserved_stock_qty>0 group by source_sku_id order by source_sku_id")
  List<String> skuIds(@Param("t") String t, @Param("o") String o);

  @Select("select id from mall_skus where id=#{id} and stock_qty is not null for update")
  String lockSku(String id);

  @Update(
      "update mall_skus s set stock_qty=stock_qty+q.quantity,updated_at=now() from (select"
          + " source_sku_id,sum(reserved_stock_qty) quantity from order_line_items where tenant_id=#{t} and"
          + " order_id=#{o} and reserved_stock_qty>0 group by source_sku_id)q where s.id=q.source_sku_id and s.stock_qty is"
          + " not null")
  int restoreStock(@Param("t") String t, @Param("o") String o);
}
