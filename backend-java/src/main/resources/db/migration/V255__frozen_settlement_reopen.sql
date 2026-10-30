alter table order_settlement_evidence add column cash_period varchar(4) check(cash_period ~ '^20[0-9]{2}$');
drop index order_one_live_settlement;
create unique index order_one_live_settlement on order_settlements(tenant_id,order_id) where status not in ('rejected','withdrawn','settled');

create view effective_order_settlements as
select s.* from order_settlements s where s.status='settled' and not exists(
 select 1 from order_settlements n where n.tenant_id=s.tenant_id and n.order_id=s.order_id and n.status='settled' and n.snapshot->>'previousSettlementId'=s.id);

create function verify_settlement_predecessor() returns trigger language plpgsql as $$
declare previous text; latest text;
begin
 perform id from purchase_orders where tenant_id=new.tenant_id and id=new.order_id for update;
 previous:=new.snapshot->>'previousSettlementId';
 select id into latest from effective_order_settlements where tenant_id=new.tenant_id and order_id=new.order_id;
 if previous is distinct from latest then raise exception 'Supplemental settlement must reference the current completed settlement'; end if;
 if previous is not null and exists(select 1 from order_settlements where tenant_id=new.tenant_id and id=previous and (kind='draft_void' or compensation_amount>0)) then raise exception 'This settlement requires a separate legal review before reopening'; end if;
 return new;
end $$;
create trigger settlement_predecessor before insert on order_settlements for each row execute function verify_settlement_predecessor();

create table funding_settlement_restorations (
 tenant_id text not null,evidence_id text not null,source_fund_id text not null,target_fund_id text not null,
 project_id text not null,plan_id text not null,amount numeric(18,2) not null check(amount>0),created_by text not null,
 created_at timestamptz not null default now(),primary key(tenant_id,evidence_id,source_fund_id),
 foreign key(tenant_id,evidence_id,source_fund_id) references funding_settlement_allocations(tenant_id,evidence_id,fund_id) deferrable initially deferred,
 foreign key(tenant_id,plan_id,target_fund_id) references project_funding_lines(tenant_id,change_id,fund_id)
);
create trigger immutable_funding_settlement_restore before update or delete on funding_settlement_restorations for each row execute function protect_special_funding_history();
create index funding_settlement_restore_project on funding_settlement_restorations(tenant_id,project_id,plan_id,target_fund_id);

create or replace view project_funding_paid_basis as
select p.*,coalesce((select sum(c.amount) from special_funding_cash c where c.tenant_id=p.tenant_id and c.project_id=p.project_id and c.change_id<>p.change_id),0) effective_prior_paid_amount
from project_funding_plans p;

create function verify_settlement_cash_period() returns trigger language plpgsql as $$
declare s order_settlements%rowtype; available numeric; current_year text;
begin
 select * into s from order_settlements where tenant_id=new.tenant_id and id=new.settlement_id;
 current_year:=s.snapshot->>'period';
 if new.kind not in ('refund','payment') or current_year is null then return null; end if;
 if new.cash_period is null then raise exception 'Cash evidence requires an explicit responsibility year'; end if;
 if new.kind='payment' and new.cash_period<>current_year then raise exception 'Topup can only use the current responsibility year'; end if;
 if new.kind='refund' then
  select coalesce(sum((v->>'amount')::numeric),0) into available from jsonb_array_elements(s.snapshot->'cashPeriods') v where v->>'period'=new.cash_period and (new.source is null or v->>'source'=new.source);
  select available+coalesce(sum(case when e.kind='refund' then -e.amount when e.kind='payment' then e.amount else 0 end),0) into available from order_settlement_evidence e where e.tenant_id=new.tenant_id and e.settlement_id=new.settlement_id and e.cash_period=new.cash_period and e.source is not distinct from new.source;
  if available<0 then raise exception 'Refund exceeds invoice net cash in selected year'; end if;
 end if;
 return null;
end $$;
create constraint trigger settlement_cash_period_complete after insert on order_settlement_evidence deferrable initially deferred for each row execute function verify_settlement_cash_period();

create or replace view project_funding_balances as
 select l.tenant_id,l.project_id,l.change_id,l.fund_id,f.code,f.name,
 (l.amount+(coalesce(c.restored,0)+coalesce(d.restored,0))+coalesce(r.adjustment,0))::numeric(18,2) allocated_amount,
 coalesce(a.paid,0) paid_amount,l.amount+(coalesce(c.restored,0)+coalesce(d.restored,0))+coalesce(r.adjustment,0)-coalesce(a.paid,0) remaining_amount
 from project_funding_plans p join project_funding_lines l on l.tenant_id=p.tenant_id and l.change_id=p.change_id
 join special_funds f on f.tenant_id=l.tenant_id and f.id=l.fund_id
 left join lateral(select sum(a.amount) paid from special_funding_cash a where a.tenant_id=l.tenant_id and a.project_id=l.project_id and a.change_id=l.change_id and a.fund_id=l.fund_id)a on true
 left join lateral(select sum(c.amount) restored from funding_correction_allocations c join frozen_payment_corrections fc on fc.tenant_id=c.tenant_id and fc.id=c.correction_id and fc.status='approved' where c.tenant_id=l.tenant_id and c.project_id=l.project_id and c.plan_id=l.change_id and c.target_fund_id=l.fund_id)c on true
 left join lateral(select sum(d.amount) restored from funding_settlement_restorations d where d.tenant_id=l.tenant_id and d.project_id=l.project_id and d.plan_id=l.change_id and d.target_fund_id=l.fund_id)d on true
 left join lateral(select sum(r.after_amount-r.before_amount) adjustment from funding_reallocation_lines r join special_funding_changes fc on fc.tenant_id=r.tenant_id and fc.id=r.change_id and fc.status='approved' where r.tenant_id=l.tenant_id and r.project_id=l.project_id and r.plan_id=l.change_id and r.fund_id=l.fund_id)r on true;

create or replace function verify_funded_settlement_cash() returns trigger language plpgsql as $$
declare e order_settlement_evidence%rowtype; s order_settlements%rowtype; k text; expected numeric;
begin
 if tg_table_name='order_settlement_evidence' then k:=new.id; else k:=new.evidence_id; end if;
 select * into e from order_settlement_evidence where tenant_id=new.tenant_id and id=k;
 select * into s from order_settlements where tenant_id=e.tenant_id and id=e.settlement_id;
 if not (s.snapshot ? 'funding') then
   if exists(select 1 from funding_settlement_allocations a where a.tenant_id=e.tenant_id and a.evidence_id=e.id) then raise exception 'Unfunded settlement cannot acquire source attribution'; end if;
   return null;
 end if;
 if e.kind not in ('payment','refund') then
   if exists(select 1 from funding_settlement_allocations a where a.tenant_id=e.tenant_id and a.evidence_id=e.id) then raise exception 'Noncash evidence cannot carry funding cash'; end if;
   return null;
 end if;
 expected:=case when e.kind='refund' then -e.amount else e.amount end;
 if s.status not in ('approved','settled') or e.source is null
   or not exists(select 1 from jsonb_array_elements(s.snapshot->'invoicePlan') item where item->>'source'=e.source)
   or coalesce((select sum(amount) from funding_settlement_allocations where tenant_id=e.tenant_id and evidence_id=e.id),0)<>expected then raise exception 'Funded settlement cash requires approved complete source lines'; end if;
 if exists(select 1 from funding_settlement_allocations a where a.tenant_id=e.tenant_id and a.evidence_id=e.id and (a.project_id is distinct from s.snapshot->'funding'->>'projectId' or not exists(select 1 from jsonb_array_elements(s.snapshot->'funding'->'sources') v where v->>'fundId'=a.fund_id and v->>'planId'=a.change_id and v->>'period'=e.cash_period) or (e.kind='payment' and a.change_id is distinct from (select change_id from project_funding_plans where tenant_id=a.tenant_id and project_id=a.project_id)) or a.created_by<>e.created_by or (a.amount>0)<>(expected>0))) then raise exception 'Settlement funding project, version or actor mismatch'; end if;
 if exists(select 1 from project_funding_balances where tenant_id=e.tenant_id and project_id=s.snapshot->'funding'->>'projectId' and (paid_amount<0 or remaining_amount<0))
   or exists(select 1 from special_fund_balances where tenant_id=e.tenant_id and available_amount<0) then raise exception 'Settlement source capacity exceeded'; end if;
 if exists(select 1 from (
   select a.fund_id,a.amount from funding_payment_allocations a join invoice_payment_entries p on p.tenant_id=a.tenant_id and p.id=a.entry_id where a.tenant_id=e.tenant_id and p.invoice_id=e.source
   union all select a.fund_id,a.amount from funding_settlement_allocations a join order_settlement_evidence p on p.tenant_id=a.tenant_id and p.id=a.evidence_id where p.tenant_id=e.tenant_id and p.source=e.source and exists(select 1 from order_settlements x where x.tenant_id=p.tenant_id and x.id=p.settlement_id and x.order_id=s.order_id and x.status in ('approved','settled'))
 )cash group by fund_id having sum(amount)<0) then raise exception 'Refund exceeds invoice source net paid'; end if;
 if exists(select 1 from funding_settlement_allocations a where a.tenant_id=e.tenant_id and a.evidence_id=e.id and a.change_id<>s.snapshot->'funding'->>'planId' and not exists(select 1 from funding_settlement_restorations r where r.tenant_id=a.tenant_id and r.evidence_id=a.evidence_id and r.source_fund_id=a.fund_id and r.project_id=a.project_id and r.plan_id=s.snapshot->'funding'->>'planId' and r.amount=-a.amount and r.created_by=a.created_by)) then raise exception 'Historical refund requires complete current-year responsibility restoration'; end if;
 if exists(select 1 from funding_settlement_restorations r join funding_settlement_allocations a on a.tenant_id=r.tenant_id and a.evidence_id=r.evidence_id and a.fund_id=r.source_fund_id where r.tenant_id=e.tenant_id and r.evidence_id=e.id and (a.amount>=0 or a.change_id=r.plan_id or r.plan_id<>s.snapshot->'funding'->>'planId' or r.amount<>-a.amount or r.created_by<>a.created_by)) then raise exception 'Restoration must match original historical refund'; end if;
 return null;
end $$;

create constraint trigger funded_settlement_restoration_complete after insert on funding_settlement_restorations deferrable initially deferred for each row execute function verify_funded_settlement_cash();
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
select po.*,greatest(coalesce(s.final_amount,po.amount),coalesce((select max(n.final_amount) from order_settlements n where n.tenant_id=po.tenant_id and n.order_id=po.id and n.status not in ('rejected','withdrawn','settled') and n.snapshot ? 'previousSettlementId'),0)) effective_amount,
 coalesce((select sum(e.amount) from invoice_payment_entries e join invoices i on i.tenant_id=e.tenant_id and i.id=e.invoice_id where i.tenant_id=po.tenant_id and i.order_id=po.id),0)+
 coalesce((select sum(case when e.kind='payment' then e.amount when e.kind='refund' then -e.amount else 0 end) from order_settlement_evidence e join order_settlements x on x.tenant_id=e.tenant_id and x.id=e.settlement_id where x.tenant_id=po.tenant_id and x.order_id=po.id and x.status in ('approved','settled')),0) effective_paid
from purchase_orders po left join effective_order_settlements s on s.tenant_id=po.tenant_id and s.order_id=po.id and s.status='settled'
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

create or replace view budget_commitment_lines as
with source_projects as (
  select tenant_id,'demand'::text source_type,demand_id source_id,min(project_id) project_id
  from procurement_project_demands group by tenant_id,demand_id having count(distinct project_id)=1
  union all
  select rd.tenant_id,'rfq',rd.rfq_id,min(pd.project_id)
  from rfq_demands rd left join procurement_project_demands pd on pd.tenant_id=rd.tenant_id and pd.demand_id=rd.demand_id
  group by rd.tenant_id,rd.rfq_id having count(*)=count(pd.project_id) and count(distinct pd.project_id)=1
), approved as (
  select * from procurement_project_lifecycle_requests where kind='carryover' and status='approved'
), latest as (
  select tenant_id,project_id,max(target_period) target_period from approved group by tenant_id,project_id
), historical_raw as (
  select r.tenant_id,r.project_id,s."departmentId" department_id,s.period,
    s."sourceType" source_type,s."sourceId" source_id,sum(s."paidAmount") paid
  from approved r cross join lateral jsonb_to_recordset(coalesce(r.snapshot->'preview'->'sources','[]'::jsonb))
    s("departmentId" text,period text,"sourceType" text,"sourceId" text,"paidAmount" numeric)
  where s.period=r.source_period and s."paidAmount">0
  group by r.tenant_id,r.project_id,s."departmentId",s.period,s."sourceType",s."sourceId"
), corrections as (
  select tenant_id,project_id,department_id,rfq_id,source_period,sum(amount) amount
  from (select tenant_id,project_id,department_id,rfq_id,source_period,amount from frozen_payment_corrections where status='approved'
 union all select s.tenant_id,p.project_id,p.department_id,o.rfq_id,e.cash_period,e.amount from order_settlement_evidence e join order_settlements s on s.tenant_id=e.tenant_id and s.id=e.settlement_id join purchase_orders o on o.tenant_id=s.tenant_id and o.id=s.order_id join lateral(select min(d.project_id) project_id,min(pr.department_id) department_id from rfq_demands r join procurement_project_demands d on d.tenant_id=r.tenant_id and d.demand_id=r.demand_id join procurement_projects pr on pr.tenant_id=d.tenant_id and pr.id=d.project_id where r.tenant_id=o.tenant_id and r.rfq_id=o.rfq_id having count(distinct d.project_id)=1) p on true where e.kind='refund' and s.status in ('approved','settled') and e.cash_period<s.snapshot->>'period') restated
  group by tenant_id,project_id,department_id,rfq_id,source_period
), historical as (
  select h.tenant_id,h.project_id,h.department_id,h.period,h.source_type,h.source_id,
    h.paid-coalesce(c.amount,0) paid
  from historical_raw h left join corrections c on c.tenant_id=h.tenant_id and c.project_id=h.project_id
    and c.department_id=h.department_id and c.source_period=h.period and h.source_type='rfq' and c.rfq_id=h.source_id
), frozen as (
  select tenant_id,project_id,department_id,source_type,source_id,sum(paid) paid from historical
  group by tenant_id,project_id,department_id,source_type,source_id
), mapped as (
  select b.*,p.project_id,c.target_period from budget_commitment_source_lines b left join source_projects p
    on p.tenant_id=b.tenant_id and p.source_type=b.source_type and p.source_id=b.source_id
  left join latest c on c.tenant_id=p.tenant_id and c.project_id=p.project_id
), grouped as (
  select tenant_id,department_id,coalesce(target_period,period) period,project_id,source_type,source_id,min(label) label,
    sum(pending) pending,sum(committed) committed,sum(order_amount) order_amount,
    case when count(paid_amount)=count(*) then sum(paid_amount) end paid_amount,sum(released_amount) released_amount
  from mapped group by tenant_id,department_id,coalesce(target_period,period),project_id,source_type,source_id
), current_lines as (
  select b.*,coalesce(f.paid,0) frozen_paid from grouped b left join frozen f on f.tenant_id=b.tenant_id and f.project_id=b.project_id
    and f.department_id=b.department_id and f.source_type=b.source_type and f.source_id=b.source_id
), labels as (
  select tenant_id,department_id,source_type,source_id,min(label) label from budget_commitment_source_lines
  group by tenant_id,department_id,source_type,source_id
)
select tenant_id,department_id,period::text period,source_type,source_id,label,
  pending,greatest(committed-frozen_paid,0) committed,greatest(order_amount-frozen_paid,0) order_amount,
  case when paid_amount is null or paid_amount<frozen_paid then null else paid_amount-frozen_paid end paid_amount,
  released_amount from current_lines
union all
select h.tenant_id,h.department_id,h.period,h.source_type,h.source_id,
  coalesce(b.label,'历史已支付责任 · '||h.source_id),0::numeric,h.paid,h.paid,h.paid,0::numeric
from historical h left join labels b on b.tenant_id=h.tenant_id and b.department_id=h.department_id
  and b.source_type=h.source_type and b.source_id=h.source_id;
