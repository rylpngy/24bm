-- 演示租户默认开启邮件通道(Webhook 留待 UI 配置演示)。
insert into tenant_notification_settings (tenant_id, email_enabled, email_recipient)
values ('tenant-acme', true, 'ops@acme.example.com')
on conflict (tenant_id) do nothing;
