package com.procurement.order.infrastructure;

import com.procurement.order.api.OrderSettlementContracts.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface OrderSettlementMapper {
  String ROW =
      "select"
          + " id,order_id,contract_id,kind,reason,previous_status,snapshot::text,goods_amount,compensation_amount,final_amount,initial_paid,initial_invoiced,status,revision,workflow_instance_id,created_by,created_at,supplier_actor,supplier_comment,supplier_acted_at,completed_by,completed_at,agreement_id,agreement_name,agreement_sha"
          + " from order_settlements ";

  @Select(
      ROW
          + "where tenant_id=#{t} and order_id=#{o} order by created_at desc,id limit #{size}"
          + " offset #{offset}")
  List<Entry> page(
      @Param("t") String t,
      @Param("o") String o,
      @Param("size") int size,
      @Param("offset") long offset);

  @Select("select count(*) from order_settlements where tenant_id=#{t} and order_id=#{o}")
  long count(@Param("t") String t, @Param("o") String o);

  @Select(ROW + "where tenant_id=#{t} and id=#{id}")
  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  Entry find(@Param("t") String t, @Param("id") String id);

  @Select(ROW + "where tenant_id=#{t} and order_id=#{o} and request_key=#{key}")
  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  Entry byKey(@Param("t") String t, @Param("o") String o, @Param("key") String key);

  @Select(
      "select exists(select 1 from order_settlements where tenant_id=#{t} and order_id=#{o} and"
          + " status not in ('rejected','withdrawn','settled'))")
  boolean locked(@Param("t") String t, @Param("o") String o);

  @Select(ROW+"where tenant_id=#{t} and order_id=#{o} and status='settled' order by created_at desc,id desc limit 1")
  Entry latest(@Param("t")String t,@Param("o")String o);

  @Select("""
select exists(select 1 from order_settlements s where s.tenant_id=#{t} and s.order_id=#{o} and s.status='settled' and s.compensation_amount>0 and
 (not exists(select 1 from jsonb_array_elements(coalesce(s.snapshot->'invoicePlan','[]'::jsonb)) p where p->>'source'='~compensation')
 or exists(select 1 from order_settlement_evidence e where e.tenant_id=s.tenant_id and e.settlement_id=s.id and e.kind in ('refund','payment') and e.source is null)))
""")
  boolean ambiguousCompensation(@Param("t")String t,@Param("o")String o);

  record CashPeriod(String source,String period,java.math.BigDecimal amount){}
  @Select("""
with project as(select distinct p.project_id from purchase_orders o join rfq_demands r on r.tenant_id=o.tenant_id and r.rfq_id=o.rfq_id join procurement_project_demands p on p.tenant_id=r.tenant_id and p.demand_id=r.demand_id where o.tenant_id=#{t} and o.id=#{o}), current_year as(select coalesce((select max(r.target_period) from procurement_project_lifecycle_requests r join project p on p.project_id=r.project_id where r.tenant_id=#{t} and r.status='approved' and r.kind='carryover'),to_char(o.created_at at time zone 'Asia/Shanghai','YYYY')) period from purchase_orders o where o.tenant_id=#{t} and o.id=#{o}), cash as (
 select e.invoice_id source,coalesce((select min(r.source_period) from procurement_project_lifecycle_requests r join project p on p.project_id=r.project_id where r.tenant_id=e.tenant_id and r.status='approved' and r.kind='carryover' and (jsonb_exists(r.snapshot->'paidEntryIds',e.id) or jsonb_exists(r.snapshot->'paidEntryIds',e.reversal_of))),(select period from current_year)) period,e.amount
 from invoice_payment_entries e join invoices i on i.tenant_id=e.tenant_id and i.id=e.invoice_id where i.tenant_id=#{t} and i.order_id=#{o}
 union all select coalesce(e.source,(select min(i.id) from invoices i where i.tenant_id=s.tenant_id and i.order_id=s.order_id having count(*)=1),'~unbilled'),coalesce(e.cash_period,to_char(e.created_at at time zone 'Asia/Shanghai','YYYY')),case when e.kind='refund' then -e.amount else e.amount end from order_settlement_evidence e join order_settlements s on s.tenant_id=e.tenant_id and s.id=e.settlement_id where s.tenant_id=#{t} and s.order_id=#{o} and s.status='settled' and e.kind in ('refund','payment'))
 select source,period,sum(amount) amount from cash group by source,period order by source,period
""")
  List<CashPeriod> cashPeriods(@Param("t")String t,@Param("o")String o);

  @Select("select coalesce(max(l.target_period),to_char(min(o.created_at) at time zone 'Asia/Shanghai','YYYY')) from purchase_orders o left join rfq_demands r on r.tenant_id=o.tenant_id and r.rfq_id=o.rfq_id left join procurement_project_demands p on p.tenant_id=r.tenant_id and p.demand_id=r.demand_id left join procurement_project_lifecycle_requests l on l.tenant_id=p.tenant_id and l.project_id=p.project_id and l.kind='carryover' and l.status='approved' where o.tenant_id=#{t} and o.id=#{o}")
  String period(@Param("t")String t,@Param("o")String o);

  @Select(
      """
select jsonb_build_object(
'orderId',o.id,'amount',o.amount,'supplierId',o.supplier_id,
'lines',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'description',l.description,'quantity',l.quantity,'unitPrice',l.unit_price,'lineAmount',l.line_amount,'skuId',l.source_sku_id,'reserved',l.reserved_stock_qty,
  'shipped',coalesce((select sum(dl.shipped_quantity) from delivery_line_items dl join deliveries d on d.id=dl.delivery_id and d.tenant_id=dl.tenant_id where dl.tenant_id=l.tenant_id and dl.order_line_id=l.id and d.order_id=o.id),0),
  'received',coalesce((select sum(rl.received_quantity) from receipt_line_items rl join receipts r on r.id=rl.receipt_id and r.tenant_id=rl.tenant_id where rl.tenant_id=l.tenant_id and rl.order_line_id=l.id and r.order_id=o.id),0),
  'qualified',coalesce((select sum(rl.qualified_quantity) from receipt_line_items rl join receipts r on r.id=rl.receipt_id and r.tenant_id=rl.tenant_id where rl.tenant_id=l.tenant_id and rl.order_line_id=l.id and r.order_id=o.id),0),
  'resolvedUnqualified',coalesce((select sum(c.returned_quantity+c.exchanged_quantity) from receipt_after_sales_line_clearance c where c.tenant_id=l.tenant_id and c.order_id=o.id and c.order_line_id=l.id and c.valid),0),
  'verifiedReturned',coalesce((select sum(p.quantity) from mall_after_sales_physical_checks p where p.tenant_id=l.tenant_id and p.order_id=o.id and p.order_line_id=l.id and p.type='退货' and p.verified),0)) order by l.id) from order_line_items l where l.tenant_id=o.tenant_id and l.order_id=o.id),'[]'::jsonb),
'contracts',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from contracts c where c.tenant_id=o.tenant_id and c.related_order_id=o.id),'[]'::jsonb),
'invoices',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from invoices i where i.tenant_id=o.tenant_id and i.order_id=o.id),'[]'::jsonb),
'payments',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from invoice_payment_entries e join invoices i on i.tenant_id=e.tenant_id and i.id=e.invoice_id where i.tenant_id=o.tenant_id and i.order_id=o.id),'[]'::jsonb),
'departmentId',(select min(d.department_id) from rfq_demands r join purchase_demands d on d.tenant_id=r.tenant_id and d.id=r.demand_id where r.tenant_id=o.tenant_id and r.rfq_id=o.rfq_id)
)::text from purchase_orders o where o.tenant_id=#{t} and o.id=#{o}
""")
  String baseline(@Param("t") String t, @Param("o") String o);

  @Select(
      """
select reason from (
select '已有采购或合同归档，须先完成归档更正' reason where exists(select 1 from procurement_execution_archives a join purchase_orders o on o.tenant_id=a.tenant_id and o.rfq_id=a.rfq_id where o.tenant_id=#{t} and o.id=#{o})
union all select '存在在审业务，须先办理完毕' where exists(select 1 from workflow_business_instances w where w.tenant_id=#{t} and w.status='processing' and w.business_type<>'order_settlement' and w.business_id in(
select id from contracts where tenant_id=#{t} and related_order_id=#{o} union select id from invoices where tenant_id=#{t} and order_id=#{o} union select id from payment_requests where tenant_id=#{t} and order_id=#{o}))
union all select '存在售后或实物退换货责任，须先核验' where exists(select 1 from mall_after_sales a left join mall_after_sales_physical_checks p on p.tenant_id=a.tenant_id and p.id=a.id where a.tenant_id=#{t} and a.order_id=#{o} and a.status not in ('已拒绝','已撤回') and (a.status<>'已完成' or (a.type in ('退货','换货') and not coalesce(p.verified,false))))
union all select '存在未归属行明细的发货或收货记录' where exists(select 1 from deliveries d where d.tenant_id=#{t} and d.order_id=#{o} and (not exists(select 1 from delivery_line_items l where l.tenant_id=d.tenant_id and l.delivery_id=d.id) or d.shipped_quantity<>(select sum(l.shipped_quantity) from delivery_line_items l where l.tenant_id=d.tenant_id and l.delivery_id=d.id)))
or exists(select 1 from receipts r where r.tenant_id=#{t} and r.order_id=#{o} and (r.inspection_conclusion not in ('全部合格','部分合格','全部不合格') or not exists(select 1 from receipt_line_items l where l.tenant_id=r.tenant_id and l.receipt_id=r.id) or r.received_quantity is distinct from (select sum(l.received_quantity) from receipt_line_items l where l.tenant_id=r.tenant_id and l.receipt_id=r.id) or r.qualified_quantity is distinct from (select sum(l.qualified_quantity) from receipt_line_items l where l.tenant_id=r.tenant_id and l.receipt_id=r.id) or exists(select 1 from receipt_after_sales_line_clearance c where c.tenant_id=r.tenant_id and c.receipt_id=r.id and (not c.valid or c.unresolved_quantity>0))))
union all select '项目在审、已结项或分包已关闭，不能直接解除清算' where exists(select 1 from purchase_orders o join rfq_demands rd on rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id join procurement_project_demands pd on pd.tenant_id=rd.tenant_id and pd.demand_id=rd.demand_id join procurement_projects p on p.tenant_id=pd.tenant_id and p.id=pd.project_id where o.tenant_id=#{t} and o.id=#{o} and (p.status<>'approved' or exists(select 1 from procurement_project_lifecycle_requests x where x.tenant_id=p.tenant_id and x.project_id=p.id and x.status='submitted') or exists(select 1 from procurement_project_packages b join procurement_project_package_demands bd on bd.tenant_id=b.tenant_id and bd.package_id=b.id where bd.tenant_id=pd.tenant_id and bd.demand_id=pd.demand_id and b.status='closed') or exists(select 1 from procurement_project_changes x where x.tenant_id=p.tenant_id and x.project_id=p.id and x.status in ('draft','submitted'))))
union all select '订单跨部门资金归属尚未拆分，须先核对' where (select count(distinct d.department_id) from purchase_orders o join rfq_demands r on r.tenant_id=o.tenant_id and r.rfq_id=o.rfq_id join purchase_demands d on d.tenant_id=r.tenant_id and d.id=r.demand_id where o.tenant_id=#{t} and o.id=#{o})>1
union all select '订单跨项目归属不唯一，须先拆分核对' where (select count(distinct d.project_id) from purchase_orders o join rfq_demands r on r.tenant_id=o.tenant_id and r.rfq_id=o.rfq_id join procurement_project_demands d on d.tenant_id=r.tenant_id and d.demand_id=r.demand_id where o.tenant_id=#{t} and o.id=#{o})>1
) b order by reason
""")
  List<String> blockers(@Param("t") String t, @Param("o") String o);

  @Insert(
      """
insert into order_settlements(id,tenant_id,order_id,supplier_id,contract_id,request_key,kind,reason,previous_status,snapshot,goods_amount,compensation_amount,final_amount,initial_paid,initial_invoiced,status,created_by,agreement_id,agreement_name,agreement_sha,agreement_bytes)
values(#{id},#{t},#{o},#{supplier},#{contract},#{key},#{kind},#{reason},#{previous},cast(#{snapshot} as jsonb),#{goods},#{compensation},#{total},#{paid},#{invoiced},'supplier_pending',#{actor},#{attachment},#{filename},#{sha},#{bytes})
""")
  void insert(Map<String, Object> values);

  @Update(
      "update order_settlements set"
          + " status=#{next},revision=revision+1,supplier_actor=#{actor},supplier_comment=#{reason},supplier_acted_at=now()"
          + " where tenant_id=#{t} and id=#{id} and revision=#{revision} and"
          + " status='supplier_pending'")
  int consent(
      @Param("t") String t,
      @Param("id") String id,
      @Param("revision") int revision,
      @Param("next") String next,
      @Param("actor") String actor,
      @Param("reason") String reason);

  @Update(
      "update order_settlements set"
          + " status=#{next},revision=revision+1,workflow_instance_id=coalesce(#{workflow,jdbcType=VARCHAR},workflow_instance_id),completed_by=#{actor,jdbcType=VARCHAR},completed_at=case"
          + " when #{next} in ('settled','rejected','withdrawn') then now() else completed_at end"
          + " where tenant_id=#{t} and id=#{id} and revision=#{revision} and status=#{previous}")
  int state(
      @Param("t") String t,
      @Param("id") String id,
      @Param("revision") int revision,
      @Param("previous") String previous,
      @Param("next") String next,
      @Param("workflow") String workflow,
      @Param("actor") String actor);

  record AgreementFile(byte[] bytes) {}

  @Select(
      "select agreement_bytes as bytes from order_settlements where tenant_id=#{t} and id=#{id}")
  AgreementFile agreement(@Param("t") String t, @Param("id") String id);

  @Select(
      "select"
          + " id,settlement_id,kind,amount,evidence_no,attachment_id,content_sha,remark,created_by,created_at,source,cash_period"
          + " from order_settlement_evidence where tenant_id=#{t} and settlement_id=#{id} order by"
          + " created_at,id")
  List<Evidence> evidence(@Param("t") String t, @Param("id") String id);

  @Select(
      "select"
          + " id,settlement_id,kind,amount,evidence_no,attachment_id,content_sha,remark,created_by,created_at,source,cash_period"
          + " from order_settlement_evidence where tenant_id=#{t} and settlement_id=#{id} and"
          + " request_key=#{key}")
  Evidence evidenceByKey(@Param("t") String t, @Param("id") String id, @Param("key") String key);

  @Insert(
      "insert into"
          + " order_settlement_evidence(id,tenant_id,settlement_id,request_key,kind,amount,evidence_no,attachment_id,content_sha,remark,created_by,source,cash_period)"
          + " values(#{id},#{t},#{settlement},#{key},#{kind},#{amount},#{reference},#{attachment},#{sha},#{remark},#{actor},#{source,jdbcType=VARCHAR},#{period,jdbcType=VARCHAR})")
  void insertEvidence(Map<String, Object> values);

  @Select(
      "select distinct l.source_sku_id from order_line_items l where l.tenant_id=#{t} and"
          + " l.order_id=#{o} and l.reserved_stock_qty>coalesce((select sum(dl.shipped_quantity)"
          + " from delivery_line_items dl where dl.tenant_id=l.tenant_id and"
          + " dl.order_line_id=l.id),0) order by l.source_sku_id")
  List<String> returnSkus(@Param("t") String t, @Param("o") String o);

  @Select("select id from mall_skus where id=#{id} and stock_qty is not null for update")
  String lockSku(String id);

  @Update(
      "update mall_skus s set stock_qty=stock_qty+x.quantity,updated_at=now() from (select"
          + " l.source_sku_id,sum(l.reserved_stock_qty-coalesce((select sum(d.shipped_quantity)"
          + " from delivery_line_items d where d.tenant_id=l.tenant_id and"
          + " d.order_line_id=l.id),0)) quantity from order_line_items l where l.tenant_id=#{t} and"
          + " l.order_id=#{o} and l.reserved_stock_qty>0 group by l.source_sku_id)x where"
          + " s.id=x.source_sku_id and x.quantity>0 and s.stock_qty is not null")
  int restoreStock(@Param("t") String t, @Param("o") String o);
}
