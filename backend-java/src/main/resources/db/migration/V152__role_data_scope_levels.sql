-- 数据范围从 2 档扩到 4 档:all / department / department_and_below(本部门及下级)/ self(仅本人)。
alter table roles drop constraint roles_data_scope_check;
alter table roles
  add constraint roles_data_scope_check
  check (data_scope in ('all', 'department', 'department_and_below', 'self'));
