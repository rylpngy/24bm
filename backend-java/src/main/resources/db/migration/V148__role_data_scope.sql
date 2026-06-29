-- 角色数据范围(行级权限):all=全部数据;department=仅本部门数据。
-- 在功能权限(permissions)之上叠加数据范围;默认 all 保持既有行为。
alter table roles
  add column data_scope text not null default 'all'
  check (data_scope in ('all', 'department'));
