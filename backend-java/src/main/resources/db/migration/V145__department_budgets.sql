-- 预算管理:部门预算池(按期间)。占用 = 该部门该期间需求金额(已通过=已用,审批中=在途),
-- 剩余 = 预算 − 已用 − 在途;占用合计超预算则预警。
create table department_budgets (
  id text primary key,
  tenant_id text not null references tenants(id),
  department_id text not null references departments(id),
  period text not null,
  total_amount numeric(16, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, department_id, period)
);

create index idx_department_budgets_tenant on department_budgets (tenant_id, period);
