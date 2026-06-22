alter table payment_archive_exception_requests
  add column action_status varchar(64) not null default '待处理';

alter table payment_archive_exception_requests
  add column action_result varchar(512);

alter table payment_archive_exception_requests
  add column handled_by varchar(64);

create index idx_payment_archive_exception_requests_tenant_action_status
  on payment_archive_exception_requests (tenant_id, action_status);
