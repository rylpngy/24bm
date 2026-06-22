alter table payment_archive_exception_requests
  add column closure_status varchar(64) not null default '待关闭';

alter table payment_archive_exception_requests
  add column closure_result varchar(512);

alter table payment_archive_exception_requests
  add column closed_by varchar(64);

create index idx_payment_archive_exception_requests_tenant_closure_status
  on payment_archive_exception_requests (tenant_id, closure_status);
