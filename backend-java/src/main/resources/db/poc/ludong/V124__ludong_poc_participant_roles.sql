-- 鲁东 POC 材料签字角色。演示账号由同一工号承担三个角色，
-- 用于验证“同一审核人只审一次，后续节点按工号自动复用”。
insert into roles (id, tenant_id, scope, name, permissions, data_scope)
values
  ('role-ldu-technical-leader', 'tenant-ludong-poc', 'buyer', '技术负责人', '[]'::jsonb, 'all'),
  ('role-ldu-compilation-participant', 'tenant-ludong-poc', 'buyer', '参与编制人员', '[]'::jsonb, 'all'),
  ('role-ldu-mall-selection-participant', 'tenant-ludong-poc', 'buyer', '网上商城选型参与人', '[]'::jsonb, 'all')
on conflict (id) do update set
  name = excluded.name;

insert into users (
  id, tenant_id, supplier_id, name, mobile, email, status, department_id,
  password_hash, employee_no, job_title
)
values (
  'user-ldu-material-participant', 'tenant-ludong-poc', null,
  '技术与材料编制人', '13810001117', 'ldu.material.participant@example.com',
  'active', 'dept-ldu-csai',
  '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O',
  'LDU200017', '技术负责人 / 材料编制与商城选型'
)
on conflict (id) do update set
  name = excluded.name,
  mobile = excluded.mobile,
  email = excluded.email,
  status = excluded.status,
  department_id = excluded.department_id,
  employee_no = excluded.employee_no,
  job_title = excluded.job_title,
  updated_at = now();

insert into user_roles (user_id, role_id)
values
  ('user-ldu-material-participant', 'role-ldu-reviewer-base'),
  ('user-ldu-material-participant', 'role-ldu-technical-leader'),
  ('user-ldu-material-participant', 'role-ldu-compilation-participant'),
  ('user-ldu-material-participant', 'role-ldu-mall-selection-participant')
on conflict do nothing;
