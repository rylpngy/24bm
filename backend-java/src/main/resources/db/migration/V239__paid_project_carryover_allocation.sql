-- Each approved carryover freezes only the paid part of its source responsibility year.
-- Old V238 snapshots contain zero paid amounts and remain valid without data rewrites.
create or replace view budget_commitment_lines as
with source_projects as (
  select tenant_id,'demand'::text source_type,demand_id source_id,min(project_id) project_id
  from procurement_project_demands group by tenant_id,demand_id having count(distinct project_id)=1
  union all
  select rd.tenant_id,'rfq',rd.rfq_id,min(pd.project_id)
  from rfq_demands rd left join procurement_project_demands pd
    on pd.tenant_id=rd.tenant_id and pd.demand_id=rd.demand_id
  group by rd.tenant_id,rd.rfq_id
  having count(*)=count(pd.project_id) and count(distinct pd.project_id)=1
), approved as (
  select * from procurement_project_lifecycle_requests where kind='carryover' and status='approved'
), latest as (
  select tenant_id,project_id,max(target_period) target_period from approved group by tenant_id,project_id
), historical as (
  select r.tenant_id,r.project_id,s."departmentId" department_id,s.period,
    s."sourceType" source_type,s."sourceId" source_id,sum(s."paidAmount") paid
  from approved r cross join lateral jsonb_to_recordset(coalesce(r.snapshot->'preview'->'sources','[]'::jsonb))
    s("departmentId" text,period text,"sourceType" text,"sourceId" text,"paidAmount" numeric)
  where s.period=r.source_period and s."paidAmount">0
  group by r.tenant_id,r.project_id,s."departmentId",s.period,s."sourceType",s."sourceId"
), frozen as (
  select tenant_id,project_id,department_id,source_type,source_id,sum(paid) paid from historical
  group by tenant_id,project_id,department_id,source_type,source_id
), mapped as (
  select b.*,p.project_id,c.target_period
  from budget_commitment_source_lines b left join source_projects p
    on p.tenant_id=b.tenant_id and p.source_type=b.source_type and p.source_id=b.source_id
  left join latest c on c.tenant_id=p.tenant_id and c.project_id=p.project_id
), grouped as (
  select tenant_id,department_id,coalesce(target_period,period) period,project_id,source_type,source_id,min(label) label,
    sum(pending) pending,sum(committed) committed,sum(order_amount) order_amount,
    case when count(paid_amount)=count(*) then sum(paid_amount) end paid_amount,sum(released_amount) released_amount
  from mapped group by tenant_id,department_id,coalesce(target_period,period),project_id,source_type,source_id
), current_lines as (
  select b.*,coalesce(f.paid,0) frozen_paid from grouped b left join frozen f
    on f.tenant_id=b.tenant_id and f.project_id=b.project_id
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
from historical h left join labels b on b.tenant_id=h.tenant_id
  and b.department_id=h.department_id and b.source_type=h.source_type and b.source_id=h.source_id;
