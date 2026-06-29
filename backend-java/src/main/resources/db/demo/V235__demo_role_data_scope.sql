-- 数据范围演示:把「采购申请员」角色限定为仅本部门(dept-it),并补充财务部需求,
-- 使「全部数据」(管理员)与「仅本部门」(申请员)在采购需求列表上呈现可见差异。
update roles set data_scope = 'department' where id = 'role-buyer-requester';

insert into purchase_demands (id, tenant_id, title, department_id, requester_id, budget, status)
values
  ('dem-demo-fin-audit', 'tenant-acme', '财务审计服务采购', 'dept-finance', 'user-buyer-li', 80000.00, '已通过'),
  ('dem-demo-fin-soft', 'tenant-acme', '财务软件年度续费', 'dept-finance', 'user-buyer-li', 45000.00, '审批中')
on conflict (id) do nothing;
