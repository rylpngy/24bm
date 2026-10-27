create table frozen_payment_corrections (
  id varchar(80) primary key,
  tenant_id varchar(80) not null references tenants(id),
  invoice_id varchar(80) not null references invoices(id),
  entry_id varchar(80) not null references invoice_payment_entries(id),
  request_key varchar(100) not null,
  project_id varchar(80) not null references procurement_projects(id),
  department_id varchar(80) not null,
  rfq_id varchar(80) not null,
  source_period varchar(4) not null,
  target_period varchar(4) not null check(target_period>source_period),
  amount numeric(18,2) not null check(amount>0),
  evidence_no varchar(200) not null,
  reason varchar(1000) not null,
  snapshot jsonb not null,
  status varchar(20) not null default 'submitted' check(status in ('submitted','approved','rejected','withdrawn')),
  revision integer not null default 1,
  workflow_instance_id varchar(80),
  reversal_id varchar(80) references invoice_payment_entries(id),
  created_by varchar(80) not null,
  created_at timestamptz not null default now(),
  completed_by varchar(80),completed_at timestamptz,
  unique(tenant_id,invoice_id,request_key),
  check(status<>'approved' or reversal_id is not null)
);
create unique index frozen_correction_once on frozen_payment_corrections(tenant_id,entry_id)
  where status in ('submitted','approved');
create index frozen_correction_page on frozen_payment_corrections(tenant_id,invoice_id,created_at desc,id);

create function protect_frozen_payment_correction() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then raise exception 'Frozen correction history cannot be deleted'; end if;
  if not exists(select 1 from invoice_payment_entries e where e.id=new.entry_id and e.tenant_id=new.tenant_id
      and e.invoice_id=new.invoice_id and e.amount=new.amount and e.amount>0) then
    raise exception 'Frozen correction must retain its original scoped payment';
  end if;
  if tg_op='UPDATE' and (old.status<>'submitted' or
      (to_jsonb(new)-array['status','revision','workflow_instance_id','reversal_id','completed_by','completed_at'])
        is distinct from (to_jsonb(old)-array['status','revision','workflow_instance_id','reversal_id','completed_by','completed_at'])
      or (old.workflow_instance_id is not null and new.workflow_instance_id is distinct from old.workflow_instance_id)) then
    raise exception 'Frozen correction source and completed history are immutable';
  end if;
  if new.status='approved' and not exists(select 1 from invoice_payment_entries e where e.id=new.reversal_id
      and e.tenant_id=new.tenant_id and e.invoice_id=new.invoice_id and e.reversal_of=new.entry_id and e.amount=-new.amount) then
    raise exception 'Approved correction requires its actual scoped reversal entry';
  end if;
  return new;
end $$;
create trigger frozen_correction_history before insert or update or delete on frozen_payment_corrections
  for each row execute function protect_frozen_payment_correction();

-- Original carryover snapshots remain immutable. This view exposes approved restatements,
-- while correction rows separately retain the old year, current year and negative entry.
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
  from frozen_payment_corrections where status='approved'
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
