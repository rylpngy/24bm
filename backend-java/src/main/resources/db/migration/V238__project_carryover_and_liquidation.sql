create table procurement_project_lifecycle_requests (
  id text primary key,
  tenant_id text not null references tenants(id),
  project_id text not null references procurement_projects(id),
  kind text not null check (kind in ('carryover','liquidation')),
  source_period varchar(4) not null,
  target_period varchar(4) not null,
  project_revision integer not null,
  reason varchar(1000) not null,
  snapshot jsonb not null,
  amount numeric(16,2) not null check (amount >= 0),
  status text not null default 'submitted' check (status in ('submitted','approved','rejected','withdrawn')),
  revision integer not null default 1,
  workflow_instance_id text,
  created_by text not null references users(id),
  created_at timestamptz not null default now(),
  completed_by text references users(id),
  completed_at timestamptz,
  check (source_period ~ '^20[0-9]{2}$' and target_period ~ '^20[0-9]{2}$'),
  check ((kind='carryover' and target_period>source_period) or (kind='liquidation' and target_period=source_period))
);
create unique index project_one_pending_lifecycle on procurement_project_lifecycle_requests(tenant_id,project_id) where status='submitted';
create unique index project_one_approved_carryover_year on procurement_project_lifecycle_requests(tenant_id,project_id,target_period) where kind='carryover' and status='approved';
create index project_lifecycle_history on procurement_project_lifecycle_requests(tenant_id,project_id,created_at desc,id);

-- Preserve the original business-year view, then move only approved financial responsibility.
-- Previously paid or unverifiable obligations are refused by the application, never silently moved.
alter view budget_commitment_lines rename to budget_commitment_source_lines;
create view budget_commitment_lines as
with source_projects as (
  select tenant_id,'demand'::text source_type,demand_id source_id,min(project_id) project_id
  from procurement_project_demands group by tenant_id,demand_id having count(distinct project_id)=1
  union all
  select rd.tenant_id,'rfq',rd.rfq_id,min(pd.project_id)
  from rfq_demands rd left join procurement_project_demands pd
    on pd.tenant_id=rd.tenant_id and pd.demand_id=rd.demand_id
  group by rd.tenant_id,rd.rfq_id
  having count(*)=count(pd.project_id) and count(distinct pd.project_id)=1
), latest as (
  select distinct on (tenant_id,project_id) tenant_id,project_id,target_period
  from procurement_project_lifecycle_requests where kind='carryover' and status='approved'
  order by tenant_id,project_id,target_period desc,id
)
select b.tenant_id,b.department_id,coalesce(c.target_period,b.period)::text period,
  b.source_type,b.source_id,b.label,b.pending,b.committed,b.order_amount,b.paid_amount,b.released_amount
from budget_commitment_source_lines b left join source_projects p
  on p.tenant_id=b.tenant_id and p.source_type=b.source_type and p.source_id=b.source_id
left join latest c on c.tenant_id=p.tenant_id and c.project_id=p.project_id;
