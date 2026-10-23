create table supplier_performance_evidence (
  id text primary key,
  task_id text not null references supplier_performance_tasks(id),
  task_version bigint not null,
  round integer not null check (round > 0),
  file_name text not null,
  storage_key text not null unique,
  size bigint not null check (size > 0 and size <= 10485760),
  sha256 text not null,
  uploaded_by text not null references users(id),
  uploader_name text not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (task_id, task_version, file_name, sha256)
);
create index idx_performance_evidence_task on supplier_performance_evidence(task_id, round, created_at);
