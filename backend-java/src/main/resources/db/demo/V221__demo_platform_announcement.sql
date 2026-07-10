-- 平台端演示:一条面向全部对象的平台公告。
insert into platform_announcements (id, title, content, audience, status, published_by)
values (
  'ann-demo',
  '关于平台 6 月系统升级维护的通知',
  '平台将于 2026-07-01 02:00–04:00 进行例行系统升级,期间登录与下单可能短暂受影响,请提前安排业务。给您带来不便敬请谅解。',
  'all', 'active', 'user-platform-admin'
)
on conflict (id) do nothing;
