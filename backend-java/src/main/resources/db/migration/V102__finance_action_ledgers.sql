create table payment_requests (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  invoice_id varchar(64) not null references invoices(id),
  supplier_id varchar(64) not null references enterprises(id),
  order_id varchar(64) not null references purchase_orders(id),
  amount numeric(14, 2) not null,
  request_status varchar(64) not null,
  payment_batch_no varchar(128) not null,
  remark text,
  created_by varchar(64) not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, invoice_id)
);

create index idx_payment_requests_tenant_status
  on payment_requests (tenant_id, request_status);

create table variance_handlings (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  invoice_id varchar(64) not null references invoices(id),
  supplier_id varchar(64) not null references enterprises(id),
  order_id varchar(64) not null references purchase_orders(id),
  variance_amount numeric(14, 2) not null,
  reason text not null,
  owner_id varchar(64) not null references users(id),
  result varchar(128) not null,
  status varchar(64) not null,
  created_by varchar(64) not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, invoice_id)
);

create index idx_variance_handlings_tenant_status
  on variance_handlings (tenant_id, status);
