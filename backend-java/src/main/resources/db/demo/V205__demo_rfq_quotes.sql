-- S4 演示：完整 RFQ + 报价(供比价定标)。
-- tech 设为已准入(与 sunrise 一起作可邀供应商；office 保持待准入演示准入流程)。

update buyer_supplier_relations set status = '已准入'
  where tenant_id = 'tenant-acme' and supplier_id = 'ent-supplier-tech';

-- 一条已通过、未链 RFQ 的需求，供创建 RFQ 表单演示。
insert into purchase_demands (id, tenant_id, title, department_id, requester_id, budget, status)
values
  ('dem-demo-server', 'tenant-acme', '机房服务器采购', 'dept-it', 'user-buyer-owner', 200000.00, '已通过')
on conflict (id) do nothing;

-- demo RFQ：报价中(封存),截止已过 → 可直接开标(无需强制),开标后方可评标定标。链 dem-demo-laptop,邀 sunrise + tech。
insert into rfqs (id, tenant_id, title, status, deadline_at, owner_id)
values
  ('rfq-demo', 'tenant-acme', '办公电脑询价(演示)', '报价中', timestamptz '2026-06-20 18:00:00+08', 'user-buyer-owner')
on conflict (id) do nothing;

insert into rfq_demands (id, tenant_id, rfq_id, demand_id)
values ('rfqd-demo-1', 'tenant-acme', 'rfq-demo', 'dem-demo-laptop')
on conflict (id) do nothing;

insert into rfq_invites (id, tenant_id, rfq_id, supplier_id, invite_status)
values
  ('rfqi-demo-1', 'tenant-acme', 'rfq-demo', 'ent-supplier-sunrise', '已邀请'),
  ('rfqi-demo-2', 'tenant-acme', 'rfq-demo', 'ent-supplier-tech', '已邀请')
on conflict (tenant_id, rfq_id, supplier_id) do nothing;

-- 两条已提交报价，供比价。
insert into quotes (id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status)
values
  ('quote-demo-1', 'tenant-acme', 'rfq-demo', 'ent-supplier-sunrise', 118000.00, 13.00, 7, '已提交'),
  ('quote-demo-2', 'tenant-acme', 'rfq-demo', 'ent-supplier-tech', 125000.00, 13.00, 10, '已提交')
on conflict (tenant_id, rfq_id, supplier_id, round) do nothing;
