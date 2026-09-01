create table ludong_poc_review_records (
  id text primary key,
  tenant_id text not null references tenants(id),
  application_id text not null references ludong_poc_applications(id),
  workflow_task_id text not null,
  node_id text not null,
  reviewer_id text not null references users(id),
  decision text not null check (decision in ('approve', 'reject')),
  review_data jsonb not null default '{}'::jsonb,
  comment text,
  reviewed_at timestamptz not null default now(),
  unique (tenant_id, workflow_task_id)
);

create index idx_ludong_poc_review_application
  on ludong_poc_review_records (tenant_id, application_id, reviewed_at asc);
