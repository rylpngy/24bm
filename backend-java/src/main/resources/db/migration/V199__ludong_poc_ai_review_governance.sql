create table ludong_poc_ai_review_runs (
  id text primary key,
  tenant_id text not null references tenants(id),
  application_id text not null references ludong_poc_applications(id),
  node_id text not null,
  analysis_mode text not null,
  model_name text not null,
  knowledge_version text not null,
  response_payload jsonb not null,
  created_by text not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_ludong_ai_review_runs_application
  on ludong_poc_ai_review_runs (tenant_id, application_id, created_at desc);

create table ludong_poc_ai_review_feedback (
  id text primary key,
  tenant_id text not null references tenants(id),
  run_id text not null references ludong_poc_ai_review_runs(id) on delete cascade,
  finding_id text not null,
  reviewer_id text not null references users(id),
  disposition text not null check (disposition in ('adopted', 'false_positive', 'noted')),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, run_id, finding_id, reviewer_id)
);

create index idx_ludong_ai_review_feedback_metrics
  on ludong_poc_ai_review_feedback (tenant_id, disposition);
