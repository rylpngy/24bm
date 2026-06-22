create table payment_archive_exception_requests (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  payment_batch_no varchar(64) not null,
  exception_type varchar(64) not null,
  exception_reason varchar(512) not null,
  approval_status varchar(64) not null,
  requested_by varchar(64) not null references users(id),
  reviewed_by varchar(64) references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, payment_batch_no, exception_type, approval_status)
);

create index idx_payment_archive_exception_requests_tenant_batch
  on payment_archive_exception_requests (tenant_id, payment_batch_no);

create index idx_payment_archive_exception_requests_tenant_status
  on payment_archive_exception_requests (tenant_id, approval_status);

create index idx_payment_archive_exception_requests_tenant_type
  on payment_archive_exception_requests (tenant_id, exception_type);
