create table supplier_performance_tasks (
  id text primary key,
  tenant_id text not null references tenants(id),
  supplier_id text not null references enterprises(id),
  relation_id text not null references buyer_supplier_relations(id),
  period text not null check (period ~ '^[1-9][0-9]{3}(-Q[1-4]|-(0[1-9]|1[0-2]))?$'),
  assignee_id text not null references users(id),
  assignee_name text not null,
  due_date date not null,
  status text not null check (status in ('assigned','evaluated','remediation_requested','remediation_submitted','closed')),
  evaluation_id text unique references supplier_evaluations(id),
  total_score numeric(5,2),
  requirement text,
  response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, supplier_id, period),
  check ((status = 'assigned' and evaluation_id is null and total_score is null)
    or (status <> 'assigned' and evaluation_id is not null and total_score is not null)),
  check (status in ('assigned','evaluated') or requirement is not null)
);
create index idx_performance_tasks_supplier on supplier_performance_tasks(supplier_id, created_at desc);
create index idx_performance_tasks_buyer on supplier_performance_tasks(tenant_id, relation_id, created_at desc);

-- Append-only business audit; all remediation/review rounds remain available.
create table supplier_performance_task_events (
  id bigserial primary key,
  task_id text not null references supplier_performance_tasks(id),
  action text not null,
  actor_id text not null,
  actor_name text not null,
  comment text,
  created_at timestamptz not null default clock_timestamp()
);
create index idx_performance_task_events on supplier_performance_task_events(task_id, id);
