-- 给演示需求补字段(期望交期/优先级/用途说明)。

update purchase_demands set
  expected_delivery_date = date '2026-07-20',
  priority = '紧急',
  purpose = '研发团队扩编，新员工办公电脑配备。'
where tenant_id = 'tenant-acme' and id = 'dem-demo-laptop';

update purchase_demands set
  expected_delivery_date = date '2026-08-05',
  priority = '常规',
  purpose = '会议室与工位显示器统一升级。'
where tenant_id = 'tenant-acme' and id = 'dem-demo-monitor';

update purchase_demands set
  expected_delivery_date = date '2026-07-30',
  priority = '紧急',
  purpose = '机房扩容，承载新业务系统。'
where tenant_id = 'tenant-acme' and id = 'dem-demo-server';
