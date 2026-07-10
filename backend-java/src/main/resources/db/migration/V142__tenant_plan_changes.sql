-- 套餐升降级留痕:记录每次套餐/用户上限变更的前后值与操作人,供平台审计与计费追溯。
create table tenant_plan_changes (
  id text primary key,
  tenant_id text not null references tenants(id),
  from_plan text not null,
  to_plan text not null,
  from_user_limit integer not null,
  to_user_limit integer not null,
  changed_by text,
  changed_at timestamptz not null default now()
);

create index idx_tenant_plan_changes_tenant on tenant_plan_changes (tenant_id, changed_at desc);
