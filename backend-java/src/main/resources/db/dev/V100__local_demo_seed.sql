insert into tenants (id, name, plan, status, enabled_features, user_limit)
values
  ('tenant-acme', 'Acme 采购公司', 'MVP', 'active', '["rfq","order","finance"]'::jsonb, 100)
on conflict (id) do update set
  name = excluded.name,
  plan = excluded.plan,
  status = excluded.status,
  enabled_features = excluded.enabled_features,
  user_limit = excluded.user_limit,
  updated_at = now();

insert into enterprises (id, name, type, industry, verified)
values
  ('ent-supplier-sunrise', '晨光科技供应商', 'supplier', '办公设备', true),
  ('supplier-tech', '星联数码供应商', 'supplier', 'IT 设备', true),
  ('ent-buyer-acme', 'Acme 采购公司', 'buyer', '综合采购', true)
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  industry = excluded.industry,
  verified = excluded.verified,
  updated_at = now();

insert into supplier_enterprises (enterprise_id, credit_code, legal_person, verified_status, profile_status)
values
  ('ent-supplier-sunrise', '91310000SUNRISE001', '王晨', 'approved', 'complete'),
  ('supplier-tech', '91310000TECH0002', '李星', 'approved', 'complete')
on conflict (enterprise_id) do update set
  credit_code = excluded.credit_code,
  legal_person = excluded.legal_person,
  verified_status = excluded.verified_status,
  profile_status = excluded.profile_status;

insert into users (id, tenant_id, supplier_id, name, mobile, email, status)
values
  ('user-platform-admin', null, null, '平台运营', '13800000000', 'platform.admin@example.com', 'active'),
  ('user-buyer-owner', 'tenant-acme', null, '采购负责人', '13800000001', 'buyer.owner@example.com', 'active'),
  ('user-buyer-requester', 'tenant-acme', null, '需求申请人', '13800000002', 'requester@example.com', 'active'),
  ('user-supplier-sales', null, 'ent-supplier-sunrise', '供应商销售', '13800000003', 'supplier.sales@example.com', 'active')
on conflict (id) do update set
  tenant_id = excluded.tenant_id,
  supplier_id = excluded.supplier_id,
  name = excluded.name,
  mobile = excluded.mobile,
  email = excluded.email,
  status = excluded.status,
  updated_at = now();

insert into roles (id, tenant_id, scope, name, permissions)
values
  ('role-buyer-owner', 'tenant-acme', 'buyer', '采购管理员', '["buyer:*"]'::jsonb),
  ('role-supplier-sales', null, 'supplier', '供应商销售', '["supplier:*"]'::jsonb),
  ('role-platform-admin', null, 'platform', '平台管理员', '["platform:*"]'::jsonb)
on conflict (id) do update set
  tenant_id = excluded.tenant_id,
  scope = excluded.scope,
  name = excluded.name,
  permissions = excluded.permissions;

insert into user_roles (user_id, role_id)
values
  ('user-buyer-owner', 'role-buyer-owner'),
  ('user-supplier-sales', 'role-supplier-sales'),
  ('user-platform-admin', 'role-platform-admin')
on conflict (user_id, role_id) do nothing;

insert into departments (id, tenant_id, name, parent_id, status)
values
  ('dept-it', 'tenant-acme', '信息化部', null, 'active'),
  ('dept-finance', 'tenant-acme', '财务部', null, 'active')
on conflict (tenant_id, name) do update set
  parent_id = excluded.parent_id,
  status = excluded.status,
  updated_at = now();

insert into buyer_supplier_relations (id, tenant_id, supplier_id, status, level, categories, performance_score)
values
  ('rel-acme-sunrise', 'tenant-acme', 'ent-supplier-sunrise', '已准入', 'A', '["办公设备","电脑整机"]'::jsonb, 94.50),
  ('rel-acme-tech', 'tenant-acme', 'supplier-tech', '待准入', 'B', '["IT 设备"]'::jsonb, 82.00)
on conflict (tenant_id, supplier_id) do update set
  status = excluded.status,
  level = excluded.level,
  categories = excluded.categories,
  performance_score = excluded.performance_score,
  updated_at = now();

insert into materials (id, tenant_id, code, name, category, unit, reference_price)
values
  ('mat-laptop', 'tenant-acme', 'IT-LAPTOP', '办公电脑', '办公设备', '台', 6000.00),
  ('mat-monitor', 'tenant-acme', 'IT-MONITOR', '显示器', '办公设备', '台', 1200.00)
on conflict (tenant_id, code) do update set
  name = excluded.name,
  category = excluded.category,
  unit = excluded.unit,
  reference_price = excluded.reference_price;

insert into purchase_demands (id, tenant_id, title, department_id, requester_id, budget, status)
values
  ('dem-local-laptop', 'tenant-acme', '本地联调办公电脑采购', 'dept-it', 'user-buyer-owner', 120000.00, '已通过')
on conflict (id) do update set
  title = excluded.title,
  department_id = excluded.department_id,
  requester_id = excluded.requester_id,
  budget = excluded.budget,
  status = excluded.status,
  updated_at = now();

insert into purchase_demand_items (id, tenant_id, demand_id, material_id, quantity)
values
  ('dem-local-laptop-item-1', 'tenant-acme', 'dem-local-laptop', 'mat-laptop', 10.0000)
on conflict (id) do nothing;
