-- 商业化收口:账单生命周期。生成时对当期用量计费做快照(头 + 行),
-- 状态流转 草稿 → 已开票 → 已结清。每租户每期一张账单。
create table billing_statements (
  id text primary key,
  tenant_id text not null references tenants(id),
  period text not null,
  plan_code text not null,
  base_price numeric(12, 2) not null,
  overage_total numeric(12, 2) not null,
  total_amount numeric(12, 2) not null,
  status text not null default '草稿',
  generated_at timestamptz not null default now(),
  issued_at timestamptz,
  paid_at timestamptz,
  unique (tenant_id, period)
);

create table billing_statement_lines (
  id text primary key,
  statement_id text not null references billing_statements(id) on delete cascade,
  metric text not null,
  label text not null,
  included_quota integer not null,
  used integer not null,
  overage integer not null,
  overage_unit_price numeric(12, 2) not null,
  overage_cost numeric(12, 2) not null,
  sort_no integer not null default 0
);

create index idx_billing_statement_lines_stmt on billing_statement_lines (statement_id, sort_no);
