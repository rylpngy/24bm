-- 重写阶段的干净最小演示种子（独立 db/demo location，绕开 baseline db/dev 的排序纠缠）。
-- 运行：SPRING_FLYWAY_LOCATIONS=classpath:db/migration,classpath:db/demo
-- 覆盖三端登录 + 采购方 workspace 基础数据。账号密码统一 demo123456（bcrypt 复用）。
-- 账号：platform.admin@example.com / buyer.owner@example.com / supplier.sales@example.com

insert into enterprises (id, name, type, industry, verified)
values
  ('ent-supplier-sunrise', '晨光科技供应商', 'supplier', '办公设备', true),
  ('ent-buyer-acme', 'Acme 采购公司', 'buyer', '综合采购', true)
on conflict (id) do nothing;

insert into supplier_enterprises (enterprise_id, credit_code, legal_person, verified_status, profile_status)
values
  ('ent-supplier-sunrise', '91310000SUNRISE001', '王晨', 'approved', 'complete')
on conflict (enterprise_id) do nothing;

insert into tenants (id, name, plan, status, enabled_features, user_limit)
values
  ('tenant-acme', 'Acme 采购公司', 'MVP', 'active', '["rfq","order","finance"]'::jsonb, 100)
on conflict (id) do nothing;

insert into departments (id, tenant_id, name, parent_id, status)
values
  ('dept-it', 'tenant-acme', '信息化部', null, 'active'),
  ('dept-finance', 'tenant-acme', '财务部', null, 'active')
on conflict (tenant_id, name) do nothing;

insert into roles (id, tenant_id, scope, name, permissions)
values
  ('role-buyer-owner', 'tenant-acme', 'buyer', '采购管理员', '["buyer:*"]'::jsonb),
  ('role-supplier-sales', null, 'supplier', '供应商销售', '["supplier:*"]'::jsonb),
  ('role-platform-admin', null, 'platform', '平台管理员', '["platform:*"]'::jsonb)
on conflict (id) do nothing;

-- password_hash 为 demo123456 的 bcrypt（复用 baseline 已知哈希）。
insert into users (id, tenant_id, supplier_id, name, mobile, email, status, department_id, password_hash)
values
  ('user-platform-admin', null, null, '平台运营', '13800000000', 'platform.admin@example.com', 'active', null, '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-buyer-owner', 'tenant-acme', null, '采购负责人', '13800000001', 'buyer.owner@example.com', 'active', 'dept-it', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-supplier-sales', null, 'ent-supplier-sunrise', '供应商销售', '13800000003', 'supplier.sales@example.com', 'active', null, '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O')
on conflict (id) do nothing;

insert into user_roles (user_id, role_id)
values
  ('user-platform-admin', 'role-platform-admin'),
  ('user-buyer-owner', 'role-buyer-owner'),
  ('user-supplier-sales', 'role-supplier-sales')
on conflict (user_id, role_id) do nothing;

insert into buyer_supplier_relations (id, tenant_id, supplier_id, status, level, categories, performance_score)
values
  ('rel-acme-sunrise', 'tenant-acme', 'ent-supplier-sunrise', '已准入', 'A', '["办公设备","电脑整机"]'::jsonb, 94.50)
on conflict (tenant_id, supplier_id) do nothing;

insert into materials (id, tenant_id, code, name, category, unit, reference_price)
values
  ('mat-laptop', 'tenant-acme', 'IT-LAPTOP', '办公电脑', '办公设备', '台', 6000.00),
  ('mat-monitor', 'tenant-acme', 'IT-MONITOR', '显示器', '办公设备', '台', 1200.00)
on conflict (tenant_id, code) do nothing;

insert into purchase_demands (id, tenant_id, title, department_id, requester_id, budget, status)
values
  ('dem-demo-laptop', 'tenant-acme', '办公电脑采购需求', 'dept-it', 'user-buyer-owner', 120000.00, '已通过'),
  ('dem-demo-monitor', 'tenant-acme', '显示器批量采购', 'dept-it', 'user-buyer-owner', 36000.00, '审批中')
on conflict (id) do nothing;
