-- 组织架构深化:部门补充负责人/描述/成立时间;成员补充工号/职位。配合部门树(parent_id 已存在)。
alter table departments
  add column description text not null default '',
  add column manager_id text references users(id),
  add column established_on date;

alter table users
  add column employee_no text,
  add column job_title text not null default '';
