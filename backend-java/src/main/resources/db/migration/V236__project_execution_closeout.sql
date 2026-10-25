create table procurement_project_adjustments (
  id text primary key, tenant_id text not null references tenants(id),
  project_id text not null references procurement_projects(id),
  package_id text references procurement_project_packages(id),
  action text not null check(action in ('rework','cancel','terminate','milestone')),
  reason varchar(1000) not null, snapshot jsonb not null,
  released_amount numeric(18,2) not null default 0,
  actor_id text not null references users(id), created_at timestamptz not null default now()
);
create index project_adjustments_recent on procurement_project_adjustments(tenant_id,project_id,created_at desc,id);
create table procurement_project_milestones (
  tenant_id text not null references tenants(id), project_id text not null references procurement_projects(id),
  package_id text not null references procurement_project_packages(id),
  milestone text not null check(milestone in ('demand','sourcing','order','receipt','payment','close')),
  due_date date not null, updated_by text not null references users(id), updated_at timestamptz not null default now(),
  primary key(tenant_id,package_id,milestone)
);
