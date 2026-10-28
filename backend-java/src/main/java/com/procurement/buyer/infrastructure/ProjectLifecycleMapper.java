package com.procurement.buyer.infrastructure;

import com.procurement.buyer.api.ProjectLifecycleContracts.*;
import com.procurement.buyer.api.ProjectLifecycleContracts.Record;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ProjectLifecycleMapper {
  @Select("select count(*) from order_settlements s join purchase_orders o on o.tenant_id=s.tenant_id and o.id=s.order_id where s.tenant_id=#{t} and s.status not in ('rejected','withdrawn') and exists(select 1 from rfq_demands rd join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id where rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id and d.project_id=#{p})")
  int orderSettlements(@Param("t")String t,@Param("p")String p);
  @Select(
      "select distinct source_period from procurement_project_lifecycle_requests where"
          + " tenant_id=#{t} and project_id=#{p} and kind='carryover' and status='approved'")
  List<String> frozenYears(@Param("t") String t, @Param("p") String p);

  @Select(
      """
select e.id,e.invoice_id,i.order_id,o.rfq_id,e.amount+coalesce((select sum(rev.amount) from invoice_payment_entries rev where rev.tenant_id=e.tenant_id and rev.invoice_id=e.invoice_id and rev.reversal_of=e.id),0) amount,e.evidence_no
from invoice_payment_entries e join invoices i on i.tenant_id=e.tenant_id and i.id=e.invoice_id
join purchase_orders o on o.tenant_id=i.tenant_id and o.id=i.order_id
where e.tenant_id=#{t} and e.amount>0
and exists(select 1 from rfq_demands rd join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id
  where rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id and d.project_id=#{p})
and e.amount+coalesce((select sum(rev.amount) from invoice_payment_entries rev where rev.tenant_id=e.tenant_id and rev.invoice_id=e.invoice_id and rev.reversal_of=e.id),0)>0
union all
select e.id,null::text,o.id,o.rfq_id,case when e.kind='refund' then -e.amount else e.amount end,e.evidence_no
from order_settlement_evidence e join order_settlements s on s.tenant_id=e.tenant_id and s.id=e.settlement_id
join purchase_orders o on o.tenant_id=s.tenant_id and o.id=s.order_id
where e.tenant_id=#{t} and e.kind in ('payment','refund') and s.status in ('approved','settled')
and exists(select 1 from rfq_demands rd join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id
  where rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id and d.project_id=#{p})
order by id
""")
  List<PaymentBasis> paidEntries(@Param("t") String t, @Param("p") String p);

  @Select(
      """
select count(*) from invoices i join purchase_orders o on o.tenant_id=i.tenant_id and o.id=i.order_id
cross join lateral(select coalesce(sum(e.amount),0) amount from invoice_payment_entries e where e.tenant_id=i.tenant_id and e.invoice_id=i.id) paid
where i.tenant_id=#{t} and exists(select 1 from rfq_demands rd join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id
  where rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id and d.project_id=#{p})
and (paid.amount<0 or paid.amount>i.amount or i.payment_status<>case when paid.amount=0 then '待付款' when paid.amount=i.amount then '已付款' else '部分付款' end)
""")
  int invalidPayments(@Param("t") String t, @Param("p") String p);

  @Select(
      """
select count(*) from (
select a.id from mall_after_sales a join purchase_orders o on o.tenant_id=a.tenant_id and o.id=a.order_id
where a.tenant_id=#{t} and a.status not in ('已拒绝','已撤回') and (a.status<>'已完成' or (a.type in ('退货','换货') and not exists(select 1 from mall_after_sales_physical_checks p where p.tenant_id=a.tenant_id and p.id=a.id and p.verified)) or (a.type='退货' and not exists(select 1 from order_settlements s where s.tenant_id=a.tenant_id and s.order_id=a.order_id and s.status='settled')))
and exists(select 1 from rfq_demands rd join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id
  where rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id and d.project_id=#{p})
union all
select c.receipt_line_id from receipt_after_sales_line_clearance c join purchase_orders o on o.tenant_id=c.tenant_id and o.id=c.order_id
join finance_receipt_acceptance r on r.tenant_id=c.tenant_id and r.id=c.receipt_id
where c.tenant_id=#{t} and not r.disposition_approved and (not c.valid or c.unresolved_quantity>0)
and exists(select 1 from rfq_demands rd join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id where rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id and d.project_id=#{p})
) unresolved
""")
  int unresolvedAfterSales(@Param("t") String t, @Param("p") String p);

  @Select(
      "select po.id from purchase_orders po where po.tenant_id=#{t} and exists(select 1 from"
          + " rfq_demands rd join procurement_project_demands d on d.tenant_id=rd.tenant_id and"
          + " d.demand_id=rd.demand_id where rd.tenant_id=po.tenant_id and rd.rfq_id=po.rfq_id and"
          + " d.project_id=#{p}) order by po.id for update of po")
  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  List<String> lockOrders(@Param("t") String t, @Param("p") String p);

  String ROW =
      "select"
          + " id,tenant_id,project_id,kind,source_period,target_period,project_revision,reason,snapshot::text,amount,status,revision,workflow_instance_id,created_by,created_at,completed_by,completed_at"
          + " from procurement_project_lifecycle_requests ";

  @Select(ROW + "where tenant_id=#{t} and id=#{id}")
  Record find(@Param("t") String t, @Param("id") String id);

  @Select(
      ROW
          + "where tenant_id=#{t} and project_id=#{p} order by created_at desc,id limit #{size}"
          + " offset #{offset}")
  List<Record> page(
      @Param("t") String t,
      @Param("p") String p,
      @Param("size") int size,
      @Param("offset") long offset);

  @Select(
      "select count(*) from procurement_project_lifecycle_requests where tenant_id=#{t} and"
          + " project_id=#{p}")
  long count(@Param("t") String t, @Param("p") String p);

  @Select(
      "select count(*) from procurement_project_lifecycle_requests where tenant_id=#{t} and"
          + " project_id=#{p} and status='submitted'")
  int pending(@Param("t") String t, @Param("p") String p);

  @Select(
      "select target_period from procurement_project_lifecycle_requests where tenant_id=#{t} and"
          + " project_id=#{p} and kind='carryover' and status='approved' order by target_period"
          + " desc limit 1")
  String period(@Param("t") String t, @Param("p") String p);

  @Select(
      """
select b.department_id,b.period,b.source_type,b.source_id,b.pending,b.committed,b.order_amount,b.paid_amount
from budget_commitment_lines b where b.tenant_id=#{t} and (
  (b.source_type='demand' and exists(select 1 from procurement_project_demands d where d.tenant_id=b.tenant_id and d.project_id=#{p} and d.demand_id=b.source_id))
  or (b.source_type='rfq' and exists(select 1 from rfq_demands rd join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id
    where rd.tenant_id=b.tenant_id and rd.rfq_id=b.source_id and d.project_id=#{p}))
  or exists(select 1 from procurement_project_lifecycle_requests r cross join lateral jsonb_array_elements(coalesce(r.snapshot->'preview'->'sources','[]'::jsonb)) s
    where r.tenant_id=b.tenant_id and r.project_id=#{p} and r.kind='carryover' and r.status='approved'
      and s->>'sourceId'=b.source_id and s->>'sourceType'=b.source_type and s->>'departmentId'=b.department_id))
order by b.source_type,b.source_id,b.department_id,b.period
""")
  List<Source> sources(@Param("t") String t, @Param("p") String p);

  @Select(
      """
select count(*) from rfq_demands rd where rd.tenant_id=#{t} and exists(
  select 1 from rfq_demands own join procurement_project_demands p on p.tenant_id=own.tenant_id and p.demand_id=own.demand_id
  where own.tenant_id=rd.tenant_id and own.rfq_id=rd.rfq_id and p.project_id=#{p})
and not exists(select 1 from procurement_project_demands p where p.tenant_id=rd.tenant_id and p.demand_id=rd.demand_id and p.project_id=#{p})
""")
  int mixedSources(@Param("t") String t, @Param("p") String p);

  @Insert(
      "insert into"
          + " procurement_project_lifecycle_requests(id,tenant_id,project_id,kind,source_period,target_period,project_revision,reason,snapshot,amount,created_by)"
          + " values(#{id},#{t},#{p},#{kind},#{source},#{target},#{revision},#{reason},cast(#{snapshot}"
          + " as jsonb),#{amount},#{actor})")
  void insert(
      @Param("id") String id,
      @Param("t") String t,
      @Param("p") String p,
      @Param("kind") String kind,
      @Param("source") String source,
      @Param("target") String target,
      @Param("revision") int revision,
      @Param("reason") String reason,
      @Param("snapshot") String snapshot,
      @Param("amount") BigDecimal amount,
      @Param("actor") String actor);

  @Update(
      "update procurement_project_lifecycle_requests set"
          + " workflow_instance_id=#{workflow},revision=revision+1 where tenant_id=#{t} and"
          + " id=#{id} and status='submitted' and workflow_instance_id is null")
  int bind(@Param("t") String t, @Param("id") String id, @Param("workflow") String workflow);

  @Update(
      "update procurement_project_lifecycle_requests set"
          + " status=#{status},completed_by=#{actor},completed_at=now(),revision=revision+1 where"
          + " tenant_id=#{t} and id=#{id} and revision=#{revision} and status='submitted'")
  int finish(
      @Param("t") String t,
      @Param("id") String id,
      @Param("revision") int revision,
      @Param("status") String status,
      @Param("actor") String actor);

  @Select(
      "select exists(select 1 from procurement_project_demands d join"
          + " procurement_project_lifecycle_requests r on r.tenant_id=d.tenant_id and"
          + " r.project_id=d.project_id where d.tenant_id=#{t} and d.demand_id=#{id} and"
          + " r.kind='carryover' and r.status='approved')")
  boolean carriedDemand(@Param("t") String t, @Param("id") String id);

  @Select(
      "select coalesce(c.target_period,to_char(d.created_at at time zone 'Asia/Shanghai','YYYY'))"
          + " from purchase_demands d left join procurement_project_demands p on"
          + " p.tenant_id=d.tenant_id and p.demand_id=d.id left join lateral(select target_period"
          + " from procurement_project_lifecycle_requests r where r.tenant_id=p.tenant_id and"
          + " r.project_id=p.project_id and r.kind='carryover' and r.status='approved' order by"
          + " target_period desc limit 1)c on true where d.tenant_id=#{t} and d.id=#{id}")
  String demandPeriod(@Param("t") String t, @Param("id") String id);
}
