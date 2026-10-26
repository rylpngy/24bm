-- Only enabled by the isolated tender POC deployment. All companies/accounts are synthetic.
insert into enterprises(id, name, type, industry, verified) values
  ('ent-ldu-demo-a', '校采数字科技（演示）', 'supplier', '计算机设备', true),
  ('ent-ldu-demo-b', '校采教学装备（演示）', 'supplier', '教学设备', true),
  ('ent-ldu-demo-c', '校采实验设备（演示）', 'supplier', '实验仪器', true)
on conflict(id) do nothing;

insert into supplier_enterprises(enterprise_id, credit_code, legal_person, verified_status, profile_status) values
  ('ent-ldu-demo-a', 'POC-LDU-SUPPLIER-A', '演示联系人甲', 'approved', 'complete'),
  ('ent-ldu-demo-b', 'POC-LDU-SUPPLIER-B', '演示联系人乙', 'approved', 'complete'),
  ('ent-ldu-demo-c', 'POC-LDU-SUPPLIER-C', '演示联系人丙', 'approved', 'complete')
on conflict(enterprise_id) do nothing;

insert into roles(id, tenant_id, scope, name, permissions) values
  ('role-ldu-tender-supplier', null, 'supplier', '磋商POC供应商', '["supplier:*"]'::jsonb)
on conflict(id) do nothing;

insert into users(id, tenant_id, supplier_id, name, email, status, password_hash) values
  ('user-ldu-supplier-a', null, 'ent-ldu-demo-a', '演示供应商甲', 'ldu.supplier.a@example.com', 'active', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-supplier-b', null, 'ent-ldu-demo-b', '演示供应商乙', 'ldu.supplier.b@example.com', 'active', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'),
  ('user-ldu-supplier-c', null, 'ent-ldu-demo-c', '演示供应商丙', 'ldu.supplier.c@example.com', 'active', '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O')
on conflict(id) do nothing;

insert into user_roles(user_id, role_id) values
  ('user-ldu-supplier-a', 'role-ldu-tender-supplier'),
  ('user-ldu-supplier-b', 'role-ldu-tender-supplier'),
  ('user-ldu-supplier-c', 'role-ldu-tender-supplier')
on conflict(user_id, role_id) do nothing;

insert into buyer_supplier_relations(id, tenant_id, supplier_id, status, level, categories, performance_score) values
  ('rel-ldu-tender-a', 'tenant-ludong-poc', 'ent-ldu-demo-a', '已准入', 'A', '["计算机设备","教学设备"]'::jsonb, 90),
  ('rel-ldu-tender-b', 'tenant-ludong-poc', 'ent-ldu-demo-b', '已准入', 'B', '["计算机设备","教学设备"]'::jsonb, 85),
  ('rel-ldu-tender-c', 'tenant-ludong-poc', 'ent-ldu-demo-c', '已准入', 'B', '["实验仪器","教学设备"]'::jsonb, 87)
on conflict(tenant_id, supplier_id) do nothing;

-- Do not invent a storage_key or seed a non-existent qualification original.
-- Qualification fixtures must be uploaded to this environment's MinIO and verified before RFQ invitations.
