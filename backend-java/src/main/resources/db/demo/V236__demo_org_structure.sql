-- 组织架构演示:搭一棵部门树(集团总部 → 信息化部/财务部/采购部/行政部),补充负责人/描述/成立时间,
-- 并给现有成员补工号与职位,使「组织架构」页有可视的层级与成员明细。
insert into departments (id, tenant_id, name, parent_id, status, description, established_on)
values ('dept-hq', 'tenant-acme', '集团总部', null, 'active', '智采云集团总部', date '2015-03-01')
on conflict (id) do nothing;

insert into departments (id, tenant_id, name, parent_id, status, description, manager_id, established_on)
values
  ('dept-purchase', 'tenant-acme', '采购部', 'dept-hq', 'active',
   '统筹全集团物资寻源、采购执行与供应商管理', 'user-buyer-owner', date '2018-05-20'),
  ('dept-admin', 'tenant-acme', '行政部', 'dept-hq', 'active', '负责行政事务与后勤保障', null, date '2016-09-01')
on conflict (id) do nothing;

-- 既有部门归入总部并补充描述/负责人/成立时间。
update departments set parent_id = 'dept-hq', description = '负责信息系统建设与运维',
  manager_id = 'user-buyer-zhang', established_on = date '2017-06-15'
  where id = 'dept-it';
update departments set parent_id = 'dept-hq', description = '负责付款结算与对账审核',
  manager_id = 'user-buyer-li', established_on = date '2017-06-15'
  where id = 'dept-finance';

-- 成员补工号与职位。采购负责人挪到采购部;张申请保留在信息化部(数据范围演示依赖其本部门=dept-it)。
update users set employee_no = 'ZC001', job_title = '采购总监', department_id = 'dept-purchase'
  where id = 'user-buyer-owner';
update users set employee_no = 'ZC012', job_title = '采购专员'
  where id = 'user-buyer-zhang';
update users set employee_no = 'ZC005', job_title = '财务经理'
  where id = 'user-buyer-li';
