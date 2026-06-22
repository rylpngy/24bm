create table payment_block_resolutions (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  payment_batch_no varchar(64) not null,
  payment_request_id varchar(64) references payment_requests(id),
  invoice_id varchar(64) references invoices(id),
  supplier_id varchar(64) references enterprises(id),
  block_reason varchar(128) not null,
  resolution_status varchar(64) not null,
  resolution_action varchar(256) not null,
  next_step varchar(256) not null,
  handled_by varchar(64) references users(id),
  created_by varchar(64) not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, payment_batch_no, payment_request_id, block_reason)
);

create index idx_payment_block_resolutions_tenant_batch
  on payment_block_resolutions (tenant_id, payment_batch_no);

create index idx_payment_block_resolutions_tenant_status
  on payment_block_resolutions (tenant_id, resolution_status);

create index idx_payment_block_resolutions_tenant_invoice
  on payment_block_resolutions (tenant_id, invoice_id);
