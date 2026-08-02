-- E-2 通知投递真实化:补投递尝试次数与最近错误,支持失败重试与排障。
alter table notification_deliveries add column attempt_count integer not null default 1;
alter table notification_deliveries add column last_error text;
