-- 演示权限矩阵:在采购管理员之外,补两个细分角色 + 两名团队成员。
insert into roles (id, tenant_id, name, scope, permissions) values
  ('role-buyer-requester', 'tenant-acme', '采购申请员', 'buyer',
   '["buyer:demand:create","buyer:demand:read","buyer:rfq:read","buyer:material:read"]'::jsonb),
  ('role-buyer-finance', 'tenant-acme', '财务专员', 'buyer',
   '["buyer:invoice:read","buyer:payment:register","buyer:contract:read"]'::jsonb)
on conflict (id) do nothing;

-- password_hash 复用 demo123456 的 bcrypt。
insert into users (id, tenant_id, supplier_id, name, mobile, email, status, department_id, password_hash) values
  ('user-buyer-zhang', 'tenant-acme', null, '张申请', '13800000011', 'zhang.req@example.com', 'active', 'dept-it',
   '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-buyer-li', 'tenant-acme', null, '李财务', '13800000012', 'li.fin@example.com', 'active', 'dept-finance',
   '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O')
on conflict (id) do nothing;

insert into user_roles (user_id, role_id) values
  ('user-buyer-zhang', 'role-buyer-requester'),
  ('user-buyer-li', 'role-buyer-finance')
on conflict (user_id, role_id) do nothing;
