alter table supplier_performance_tasks
  add column version bigint not null default 0 check (version >= 0);
