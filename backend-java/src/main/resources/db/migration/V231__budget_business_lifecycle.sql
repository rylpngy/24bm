create table budget_pool_versions (
  tenant_id text not null references tenants(id), department_id text not null references departments(id),
  period varchar(4) not null check (period ~ '^[0-9]{4}$'), version bigint not null default 0,
  primary key (tenant_id, department_id, period)
);

create table budget_policies (
  tenant_id text primary key references tenants(id),
  mode text not null check (mode in ('warning', 'approval', 'hard')),
  revision bigint not null default 1, reason text not null, updated_by text not null references users(id),
  updated_at timestamptz not null default now()
);

create table budget_change_requests (
  id text primary key, tenant_id text not null references tenants(id),
  department_id text not null references departments(id), period varchar(4) not null check (period ~ '^[0-9]{4}$'),
  kind text not null check (kind in ('initial', 'adjustment', 'exception')),
  target_amount numeric(16,2) not null check (target_amount >= 0),
  base_amount numeric(16,2) not null, base_version bigint not null, revision bigint not null default 0,
  target_type text check (target_type in ('purchase_demand', 'rfq', 'department_order')), target_id text,
  title varchar(200) not null, reason varchar(2000) not null,
  status text not null check (status in ('draft', 'submitted', 'approved', 'rejected', 'withdrawn')),
  created_by text not null references users(id), workflow_instance_id text,
  approved_by text references users(id), approved_at timestamptz, expires_at timestamptz,
  consumed_by text references users(id), consumed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  consumed_transaction bigint,
  check ((kind = 'exception' and target_type is not null and target_id is not null)
    or (kind <> 'exception' and target_type is null and target_id is null))
);
create unique index budget_single_pending_change on budget_change_requests(tenant_id,department_id,period)
  where status = 'submitted' and kind <> 'exception';
create index budget_requests_tenant_recent on budget_change_requests(tenant_id,updated_at desc,id);
create index budget_exception_target on budget_change_requests(tenant_id,target_type,target_id,department_id,period)
  where kind = 'exception' and status = 'approved' and consumed_at is null;

create table budget_order_allocations (
  order_id text primary key references purchase_orders(id), tenant_id text not null references tenants(id),
  department_id text not null references departments(id), period varchar(4) not null check (period ~ '^[0-9]{4}$'),
  assigned_by text not null references users(id), assigned_at timestamptz not null default now()
);

create table budget_project_settlements (
  tenant_id text not null references tenants(id), rfq_id text not null references rfqs(id),
  archive_id text not null references procurement_execution_archives(id),
  demand_amount numeric(16,2) not null, order_amount numeric(16,2) not null, paid_amount numeric(16,2) not null,
  settled_by text not null references users(id), settled_at timestamptz not null default now(),
  primary key (tenant_id,rfq_id)
);

-- One source line per department/year: payments are evidence within exposure, never an additional deduction.
create view budget_commitment_lines as
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
), order_totals as (
  select tenant_id,rfq_id,sum(amount) as amount from purchase_orders group by tenant_id,rfq_id
), payment_totals as (
  select po.tenant_id,po.rfq_id,sum(pe.amount) as amount from invoice_payment_entries pe
  join invoices i on i.tenant_id=pe.tenant_id and i.id=pe.invoice_id
  join purchase_orders po on po.tenant_id=i.tenant_id and po.id=i.order_id group by po.tenant_id,po.rfq_id
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
  greatest(po.amount,coalesce(paid.amount,0)),po.amount,
  case when exists(select 1 from unverified_rfqs u where u.tenant_id=po.tenant_id and u.rfq_id=po.rfq_id)
    then null else coalesce(paid.amount,0) end,0::numeric
from budget_order_allocations a join purchase_orders po on po.tenant_id=a.tenant_id and po.id=a.order_id
left join lateral(select greatest(coalesce(sum(pe.amount),0),0) as amount from invoice_payment_entries pe
  join invoices i on i.id=pe.invoice_id and i.tenant_id=pe.tenant_id where i.tenant_id=po.tenant_id and i.order_id=po.id) paid on true
where not exists(select 1 from selected_links l where l.tenant_id=po.tenant_id and l.rfq_id=po.rfq_id);
