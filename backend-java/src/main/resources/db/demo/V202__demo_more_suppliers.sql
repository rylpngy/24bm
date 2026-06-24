-- 更多演示供应商，覆盖准入生命周期不同状态（待准入 / 准入审批中）。

insert into enterprises (id, name, type, industry, verified)
values
  ('ent-supplier-tech', '星联数码供应商', 'supplier', 'IT 设备', true),
  ('ent-supplier-office', '恒通办公供应商', 'supplier', '办公耗材', false)
on conflict (id) do nothing;

insert into supplier_enterprises (enterprise_id, credit_code, legal_person, verified_status, profile_status)
values
  ('ent-supplier-tech', '91310000TECH0002', '李星', 'approved', 'complete'),
  ('ent-supplier-office', '91310000OFFICE03', '陈恒', 'pending', 'draft')
on conflict (enterprise_id) do nothing;

insert into buyer_supplier_relations (id, tenant_id, supplier_id, status, level, categories, performance_score)
values
  ('rel-acme-tech', 'tenant-acme', 'ent-supplier-tech', '准入审批中', 'B', '["IT 设备"]'::jsonb, 82.00),
  ('rel-acme-office', 'tenant-acme', 'ent-supplier-office', '待准入', 'C', '["办公耗材"]'::jsonb, 0.00)
on conflict (tenant_id, supplier_id) do nothing;
