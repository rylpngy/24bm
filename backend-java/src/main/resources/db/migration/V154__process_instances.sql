-- 流程实例:从已发布流程发起的审批实例。resolved_path 为按表单取值解析出的审批路径快照。
-- 与现有审批引擎打通:每个审批节点在 approval_tasks 建任务(biz_type='process_instance'),进 审批中心 统一收件箱。
create table process_instances (
  id text primary key,
  tenant_id text not null references tenants(id),
  process_id text not null references process_definitions(id),
  process_name text not null,
  amount numeric(16, 2),
  form_data jsonb not null default '{}'::jsonb,
  resolved_path jsonb not null default '[]'::jsonb,
  current_index integer not null default 0,
  status text not null default 'processing' check (status in ('processing', 'approved', 'rejected')),
  initiator_id text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_process_instances_tenant on process_instances (tenant_id, created_at desc);
create index idx_process_instances_process on process_instances (tenant_id, process_id);
