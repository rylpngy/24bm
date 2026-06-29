-- 流程引擎演示:5 个审批流程,采购立项审批含完整表单 + 条件分支流程。
insert into process_definitions (id, tenant_id, name, description, icon, status, form_schema, flow_schema, updated_at)
values
  ('proc-purchase', 'tenant-acme', '采购立项审批', '适用于非生产性物资采购申请', 'box', 'enabled',
   '{"fields":[
       {"id":"f1","type":"textarea","label":"申请事由","placeholder":"请输入申请事由","required":true},
       {"id":"f2","type":"money","label":"预估金额","placeholder":"0.00","required":true},
       {"id":"f3","type":"select","label":"费用类型","placeholder":"请选择","required":false,"options":["办公用品","设备采购","服务采购"]}
     ]}'::jsonb,
   '{"steps":[
       {"id":"s1","type":"approver","title":"部门主管","assignee":"直接主管"},
       {"id":"s2","type":"condition","branches":[
         {"label":"金额 < 5000","steps":[{"id":"b1","type":"auto","title":"系统自动通过"}]},
         {"label":"金额 ≥ 5000","steps":[{"id":"b2","type":"approver","title":"财务总监","assignee":"王总"}]}
       ]}
     ]}'::jsonb,
   timestamptz '2023-10-25 10:00:00+08'),

  ('proc-supplier', 'tenant-acme', '供应商准入审批', '新供应商引进资质审核流程', 'user-plus', 'enabled',
   '{"fields":[
       {"id":"f1","type":"text","label":"供应商名称","placeholder":"请输入供应商名称","required":true},
       {"id":"f2","type":"select","label":"供应商分类","placeholder":"请选择","required":true,"options":["物料","服务","工程"]}
     ]}'::jsonb,
   '{"steps":[{"id":"s1","type":"approver","title":"采购主管","assignee":"直接主管"},{"id":"s2","type":"approver","title":"合规风控","assignee":"风控专员"}]}'::jsonb,
   timestamptz '2023-10-20 10:00:00+08'),

  ('proc-contract', 'tenant-acme', '合同签署审批', '标准采购合同用印申请', 'file-text', 'enabled',
   '{"fields":[{"id":"f1","type":"text","label":"合同名称","placeholder":"请输入合同名称","required":true},{"id":"f2","type":"money","label":"合同金额","placeholder":"0.00","required":true}]}'::jsonb,
   '{"steps":[{"id":"s1","type":"approver","title":"法务审核","assignee":"法务专员"},{"id":"s2","type":"approver","title":"分管领导","assignee":"分管副总"}]}'::jsonb,
   timestamptz '2023-10-15 10:00:00+08'),

  ('proc-payment', 'tenant-acme', '付款申请', '对公付款及预付款申请', 'credit-card', 'enabled',
   '{"fields":[{"id":"f1","type":"money","label":"付款金额","placeholder":"0.00","required":true},{"id":"f2","type":"date","label":"计划付款日","placeholder":"","required":true}]}'::jsonb,
   '{"steps":[{"id":"s1","type":"approver","title":"财务复核","assignee":"财务经理"}]}'::jsonb,
   timestamptz '2023-10-28 10:00:00+08'),

  ('proc-travel', 'tenant-acme', '出差报销', '员工差旅费用报销流程', 'plane', 'draft',
   '{"fields":[{"id":"f1","type":"money","label":"报销金额","placeholder":"0.00","required":true}]}'::jsonb,
   '{"steps":[]}'::jsonb,
   timestamptz '2023-10-01 10:00:00+08')
on conflict (id) do nothing;
