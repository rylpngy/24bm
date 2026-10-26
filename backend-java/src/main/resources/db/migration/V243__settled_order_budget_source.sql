create or replace view budget_commitment_source_lines as
with active_demands as (
  select pd.*, to_char(pd.created_at at time zone 'Asia/Shanghai','YYYY') as period
  from purchase_demands pd where pd.status in ('审批中','已通过','已转询价')
), selected_links as (
  select distinct on (pd.tenant_id,pd.id) pd.tenant_id,pd.id as demand_id,rd.rfq_id
  from active_demands pd join rfq_demands rd on rd.tenant_id=pd.tenant_id and rd.demand_id=pd.id
  join rfqs r on r.tenant_id=rd.tenant_id and r.id=rd.rfq_id
  where pd.status in ('已通过','已转询价') and r.status not in ('已流标','已废标','已取消')
  order by pd.tenant_id,pd.id,r.created_at desc,r.id desc
), weights as (
  select pd.tenant_id,l.rfq_id,pd.department_id,pd.period,sum(greatest(pd.budget,0)) as weight
  from active_demands pd join selected_links l on l.tenant_id=pd.tenant_id and l.demand_id=pd.id
  group by pd.tenant_id,l.rfq_id,pd.department_id,pd.period
), effective_orders as (
select po.*,coalesce(s.final_amount,po.amount) effective_amount,
 coalesce((select sum(e.amount) from invoice_payment_entries e join invoices i on i.tenant_id=e.tenant_id and i.id=e.invoice_id where i.tenant_id=po.tenant_id and i.order_id=po.id),0)+
 coalesce((select sum(case when e.kind='payment' then e.amount when e.kind='refund' then -e.amount else 0 end) from order_settlement_evidence e join order_settlements x on x.tenant_id=e.tenant_id and x.id=e.settlement_id where x.tenant_id=po.tenant_id and x.order_id=po.id and x.status in ('approved','settled')),0) effective_paid
from purchase_orders po left join order_settlements s on s.tenant_id=po.tenant_id and s.order_id=po.id and s.status='settled'
), order_totals as (
  select tenant_id,rfq_id,sum(effective_amount) as amount from effective_orders po where not (po.status='已取消' and exists(select 1 from order_cancellation_requests c where c.tenant_id=po.tenant_id and c.order_id=po.id and c.status='accepted')) group by tenant_id,rfq_id
), payment_totals as (
  select po.tenant_id,po.rfq_id,sum(po.effective_paid) as amount from effective_orders po group by po.tenant_id,po.rfq_id
), unverified_rfqs as (
  select distinct po.tenant_id,po.rfq_id from invoices i
  join purchase_orders po on po.tenant_id=i.tenant_id and po.id=i.order_id
  where i.payment_status in ('已付款','部分付款') and not exists(
    select 1 from invoice_payment_entries pe where pe.tenant_id=i.tenant_id and pe.invoice_id=i.id)
  union
  select rd.tenant_id,rd.rfq_id from rfq_demands rd
  left join purchase_demands pd on pd.tenant_id=rd.tenant_id and pd.id=rd.demand_id
  where pd.id is null or pd.budget is null or pd.budget<=0 or pd.department_id is null
), ranked as (
  select w.*,sum(weight) over p as total_weight,
    row_number() over(partition by w.tenant_id,w.rfq_id order by w.department_id,w.period) as rn,
    count(*) over p as cnt,coalesce(o.amount,0) as order_amount,greatest(coalesce(pay.amount,0),0) as paid_amount
  from weights w left join order_totals o on o.tenant_id=w.tenant_id and o.rfq_id=w.rfq_id
  left join payment_totals pay on pay.tenant_id=w.tenant_id and pay.rfq_id=w.rfq_id
  window p as(partition by w.tenant_id,w.rfq_id)
), exposure as (
  select r.*,case when s.order_amount=r.order_amount and s.paid_amount=r.paid_amount and s.demand_amount=r.total_weight
    then greatest(r.order_amount,r.paid_amount) else greatest(r.total_weight,r.order_amount,r.paid_amount) end as occupied
  from ranked r left join budget_project_settlements s on s.tenant_id=r.tenant_id and s.rfq_id=r.rfq_id
), amounts as (
  select e.*,round(occupied*weight/nullif(total_weight,0),2) as rounded_occupied,
    round(order_amount*weight/nullif(total_weight,0),2) as rounded_orders,
    round(paid_amount*weight/nullif(total_weight,0),2) as rounded_paid
  from exposure e
), allocated as (
  select a.*,
    case when rn=cnt then occupied-sum(case when rn<>cnt then rounded_occupied else 0 end) over p else rounded_occupied end as allocation,
    case when rn=cnt then order_amount-sum(case when rn<>cnt then rounded_orders else 0 end) over p else rounded_orders end as orders,
    case when rn=cnt then paid_amount-sum(case when rn<>cnt then rounded_paid else 0 end) over p else rounded_paid end as paid
  from amounts a window p as(partition by tenant_id,rfq_id)
)
select pd.tenant_id,pd.department_id,pd.period,'demand'::text as source_type,pd.id as source_id,pd.title as label,
  case when pd.status='审批中' then coalesce(pd.budget,0) else 0 end::numeric as pending,
  case when pd.status in ('已通过','已转询价') then coalesce(pd.budget,0) else 0 end::numeric as committed,
  0::numeric as order_amount,0::numeric as paid_amount,0::numeric as released_amount
from active_demands pd where not exists(select 1 from selected_links l where l.tenant_id=pd.tenant_id and l.demand_id=pd.id)
union all
select a.tenant_id,a.department_id,a.period,'rfq',a.rfq_id,r.title,0::numeric,coalesce(a.allocation,a.weight),
  coalesce(a.orders,0),case when exists(select 1 from unverified_rfqs u where u.tenant_id=a.tenant_id and u.rfq_id=a.rfq_id)
    then null else coalesce(a.paid,0) end,greatest(a.weight-coalesce(a.allocation,a.weight),0)
from allocated a join rfqs r on r.tenant_id=a.tenant_id and r.id=a.rfq_id
union all
select a.tenant_id,a.department_id,a.period,'order',po.id,po.id,0::numeric,
  greatest(po.effective_amount,po.effective_paid),po.effective_amount,
  case when exists(select 1 from unverified_rfqs u where u.tenant_id=po.tenant_id and u.rfq_id=po.rfq_id)
    then null else po.effective_paid end,0::numeric
from budget_order_allocations a join effective_orders po on po.tenant_id=a.tenant_id and po.id=a.order_id
where not exists(select 1 from selected_links l where l.tenant_id=po.tenant_id and l.rfq_id=po.rfq_id)
and not (po.status='已取消' and exists(select 1 from order_cancellation_requests c where c.tenant_id=po.tenant_id and c.order_id=po.id and c.status='accepted'));
