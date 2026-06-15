create table dictionaries (
  type text not null,
  code text not null,
  label text not null,
  sort_order integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (type, code)
);

create index idx_dictionaries_type_status on dictionaries (type, status, sort_order);

insert into dictionaries (type, code, label, sort_order, status)
values
  ('payment_status', 'pending', '待付款', 10, 'active'),
  ('payment_status', 'partial_paid', '部分付款', 20, 'active'),
  ('payment_status', 'paid', '已付款', 30, 'active'),
  ('announcement_audience', 'all', '全部', 10, 'active'),
  ('announcement_audience', 'buyer', '采购方', 20, 'active'),
  ('announcement_audience', 'supplier', '供应商', 30, 'active'),
  ('supplier_user_status', 'active', '启用', 10, 'active'),
  ('supplier_user_status', 'inactive', '停用', 20, 'active'),
  ('attachment_visibility', 'tenant', '租户内可见', 10, 'active'),
  ('attachment_visibility', 'buyer_internal', '采购方内部', 20, 'active'),
  ('attachment_visibility', 'supplier_shared', '供应商共享', 30, 'active')
on conflict (type, code) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();
