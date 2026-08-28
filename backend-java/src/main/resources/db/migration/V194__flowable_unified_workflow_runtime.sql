-- 统一工作流运行时：流程定义仍由业务库保存，但生产实例、待办和历史统一以 Flowable 为准。
-- 旧 process_instances / approval_tasks 仅保留为历史兼容数据；本迁移后的新流程不再写入二者。

alter table process_definitions
  add column if not exists business_type text,
  add column if not exists active_version_id text,
  add column if not exists published_at timestamptz,
  add column if not exists published_by text references users(id);

create table workflow_definition_versions (
  id text primary key,
  tenant_id text not null references tenants(id),
  process_definition_id text not null references process_definitions(id),
  business_type text not null,
  version_no integer not null check (version_no > 0),
  status text not null check (status in ('published', 'superseded')),
  form_schema jsonb not null,
  flow_schema jsonb not null,
  flowable_process_key text not null,
  flowable_process_definition_id text not null,
  flowable_deployment_id text not null,
  published_by text references users(id),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, process_definition_id, version_no)
);

create index idx_workflow_definition_versions_tenant_business
  on workflow_definition_versions (tenant_id, business_type, published_at desc);

create unique index uq_workflow_published_definition_per_business
  on workflow_definition_versions (tenant_id, business_type)
  where status = 'published';

alter table process_definitions
  add constraint fk_process_definitions_active_version
  foreign key (active_version_id) references workflow_definition_versions(id);

create table workflow_business_instances (
  id text primary key,
  tenant_id text not null references tenants(id),
  business_type text not null,
  business_id text not null,
  definition_version_id text not null references workflow_definition_versions(id),
  flowable_process_instance_id text not null unique,
  status text not null check (status in ('processing', 'approved', 'rejected', 'cancelled')),
  initiator_id text not null references users(id),
  department_id text,
  amount numeric(16, 2),
  form_data jsonb not null default '{}'::jsonb,
  business_snapshot jsonb not null default '{}'::jsonb,
  completed_by text references users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_workflow_business_instances_tenant_business
  on workflow_business_instances (tenant_id, business_type, business_id, created_at desc);

create index idx_workflow_business_instances_tenant_status
  on workflow_business_instances (tenant_id, status, updated_at desc);

create unique index uq_workflow_active_business_instance
  on workflow_business_instances (tenant_id, business_type, business_id)
  where status = 'processing';

create table workflow_task_events (
  id text primary key,
  tenant_id text not null references tenants(id),
  workflow_instance_id text not null references workflow_business_instances(id),
  flowable_task_id text,
  node_id text,
  node_name text,
  action text not null check (action in ('created', 'claimed', 'approved', 'rejected', 'completed')),
  actor_id text references users(id),
  comment text,
  created_at timestamptz not null default now()
);

create index idx_workflow_task_events_instance
  on workflow_task_events (tenant_id, workflow_instance_id, created_at asc);

-- 同一 Flowable 任务的同类事件只能记录一次。任务创建事件会在流程发起和节点推进后各查询一次，
-- 这里以数据库约束保证历史时间线不会因重试而重复。
create unique index uq_workflow_task_event_once
  on workflow_task_events (tenant_id, workflow_instance_id, flowable_task_id, action)
  where flowable_task_id is not null;
