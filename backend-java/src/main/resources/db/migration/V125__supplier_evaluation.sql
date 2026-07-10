-- SRM 绩效考核：多维周期评估 + 生命周期标记（绩效驱动）。

alter table buyer_supplier_relations
  add column if not exists cooperation_tier text not null default '合格';

alter table buyer_supplier_relations
  add column if not exists last_evaluation_score numeric(5, 2);

alter table buyer_supplier_relations
  add column if not exists last_evaluated_at timestamptz;

create table supplier_evaluations (
  id text primary key,
  tenant_id text not null references tenants(id),
  supplier_id text not null references enterprises(id),
  period text not null,
  quality_score numeric(5, 2) not null,
  delivery_score numeric(5, 2) not null,
  price_score numeric(5, 2) not null,
  service_score numeric(5, 2) not null,
  total_score numeric(5, 2) not null,
  suggested_tier text not null,
  comment text,
  evaluated_by text,
  created_at timestamptz not null default now(),
  unique (tenant_id, supplier_id, period)
);

create index idx_supplier_evaluations_tenant_supplier
  on supplier_evaluations (tenant_id, supplier_id);
