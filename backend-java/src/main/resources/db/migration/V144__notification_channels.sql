-- 多通道通知:每租户配置邮件/Webhook 渠道,并记录每次多通道分发的投递结果。
create table tenant_notification_settings (
  tenant_id text primary key references tenants(id),
  email_enabled boolean not null default false,
  email_recipient text,
  webhook_enabled boolean not null default false,
  webhook_url text,
  updated_at timestamptz not null default now()
);

create table notification_deliveries (
  id text primary key,
  tenant_id text not null references tenants(id),
  channel text not null,
  target text,
  title text not null,
  content text not null,
  status text not null,
  detail text,
  dispatched_at timestamptz not null default now()
);

create index idx_notification_deliveries_tenant on notification_deliveries (tenant_id, dispatched_at desc);
