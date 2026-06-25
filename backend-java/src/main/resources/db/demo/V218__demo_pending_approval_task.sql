-- 为演示提供一条待审批任务：审批中的显示器采购需求 dem-demo-monitor。
insert into approval_tasks (id, tenant_id, biz_type, biz_id, assignee_id, status)
values ('appr-demo-monitor', 'tenant-acme', 'purchase_demand', 'dem-demo-monitor', 'user-buyer-owner', '待审批')
on conflict (id) do nothing;
