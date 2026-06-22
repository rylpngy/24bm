create table three_way_matches (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  invoice_id varchar(64) not null references invoices(id),
  supplier_id varchar(64) not null references enterprises(id),
  order_id varchar(64) not null references purchase_orders(id),
  order_amount numeric(14, 2) not null,
  receipt_status varchar(64) not null,
  invoice_amount numeric(14, 2) not null,
  variance_amount numeric(14, 2) not null,
  match_status varchar(64) not null,
  blocking_reason varchar(128) not null,
  payment_readiness varchar(64) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, invoice_id)
);

create index idx_three_way_matches_tenant_status
  on three_way_matches (tenant_id, match_status);

create index idx_three_way_matches_tenant_supplier
  on three_way_matches (tenant_id, supplier_id);
