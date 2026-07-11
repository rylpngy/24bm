-- 平台管理员引导行:Keycloak realm 随部署包内置 platform.admin 账号(claim userId=user-platform-admin),
-- 但干净库 users 表无此行,导致平台侧操作写审计日志时 actor_id 外键失败(试点预演发现)。
-- 密码列留空:该账号仅通过 Keycloak OIDC 登录,自研登录路径不可用。
insert into users (id, tenant_id, supplier_id, name, mobile, email, status, department_id, password_hash)
values ('user-platform-admin', null, null, '平台运营', null, 'platform.admin@example.com', 'active', null, null)
on conflict (id) do nothing;
