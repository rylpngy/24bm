create table payment_batches (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  payment_batch_no varchar(128) not null,
  supplier_id varchar(64) references enterprises(id),
  request_count integer not null default 0,
  total_amount numeric(14, 2) not null default 0,
  approved_amount numeric(14, 2) not null default 0,
  batch_status varchar(64) not null,
  planned_payment_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, payment_batch_no)
);

create index idx_payment_batches_tenant_status
  on payment_batches (tenant_id, batch_status);

create index idx_payment_batches_tenant_supplier
  on payment_batches (tenant_id, supplier_id);
