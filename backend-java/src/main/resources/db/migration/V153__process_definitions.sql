-- 流程引擎:可视化配置的审批流程定义。form_schema/flow_schema 为前端拥有的 JSON 结构。
create table process_definitions (
  id text primary key,
  tenant_id text not null references tenants(id),
  name text not null,
  description text not null default '',
  icon text not null default 'file',
  status text not null default 'draft' check (status in ('draft', 'enabled', 'disabled')),
  form_schema jsonb not null default '{"fields":[]}'::jsonb,
  flow_schema jsonb not null default '{"steps":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index idx_process_definitions_tenant on process_definitions (tenant_id, updated_at desc);
