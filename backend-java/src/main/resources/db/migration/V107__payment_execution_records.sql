create table payment_execution_records (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  payment_batch_no varchar(128) not null,
  payment_request_id varchar(64) not null references payment_requests(id),
  invoice_id varchar(64) not null references invoices(id),
  supplier_id varchar(64) references enterprises(id),
  registered_amount numeric(14, 2) not null default 0,
  planned_payment_date date,
  execution_status varchar(64) not null,
  execution_trace varchar(512) not null,
  created_by varchar(64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, payment_request_id)
);

create index idx_payment_execution_records_tenant_batch
  on payment_execution_records (tenant_id, payment_batch_no);

create index idx_payment_execution_records_tenant_invoice
  on payment_execution_records (tenant_id, invoice_id);

create index idx_payment_execution_records_tenant_status
  on payment_execution_records (tenant_id, execution_status);
