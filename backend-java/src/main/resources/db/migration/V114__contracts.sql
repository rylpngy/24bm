create table contracts (
  id text primary key,
  tenant_id text not null references tenants(id),
  contract_no text not null,
  contract_name text not null,
  related_order_id text not null references purchase_orders(id),
  supplier_id text not null references enterprises(id),
  amount numeric(14, 2) not null,
  status text not null,
  archive_status text not null default '未归档',
  fulfillment_progress text not null default '待同步',
  effective_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, contract_no),
  unique (tenant_id, related_order_id)
);

create index if not exists idx_contracts_tenant_status
  on contracts (tenant_id, status);

create index if not exists idx_contracts_tenant_archive_status
  on contracts (tenant_id, archive_status);

create index if not exists idx_contracts_tenant_supplier
  on contracts (tenant_id, supplier_id);
