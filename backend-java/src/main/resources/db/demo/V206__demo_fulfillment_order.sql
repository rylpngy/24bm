-- S5 演示：一条已发货的订单链(独立 RFQ)，供采购方收货演示。
-- 与 rfq-demo(定标审批中)解耦，避免订单唯一约束冲突。

insert into purchase_demands (id, tenant_id, title, department_id, requester_id, budget, status)
values
  ('dem-demo-printer', 'tenant-acme', '激光打印机采购', 'dept-it', 'user-buyer-owner', 48000.00, '已通过')
on conflict (id) do nothing;

insert into rfqs (id, tenant_id, title, status, deadline_at, owner_id, awarded_supplier_id)
values
  ('rfq-fulfilled', 'tenant-acme', '打印机询价(已定标)', '已定标',
   timestamptz '2026-06-15 18:00:00+08', 'user-buyer-owner', 'ent-supplier-sunrise')
on conflict (id) do nothing;

insert into rfq_demands (id, tenant_id, rfq_id, demand_id)
values ('rfqd-fulfilled-1', 'tenant-acme', 'rfq-fulfilled', 'dem-demo-printer')
on conflict (id) do nothing;

insert into rfq_invites (id, tenant_id, rfq_id, supplier_id, invite_status)
values ('rfqi-fulfilled-1', 'tenant-acme', 'rfq-fulfilled', 'ent-supplier-sunrise', '已邀请')
on conflict (tenant_id, rfq_id, supplier_id) do nothing;

-- 已发货订单 + 发货记录(收货前置：必须有已发货事实)。
insert into purchase_orders (id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date)
values
  ('po-demo', 'tenant-acme', 'rfq-fulfilled', 'ent-supplier-sunrise', 46000.00, '已发货', date '2026-07-05')
on conflict (tenant_id, rfq_id, supplier_id) do nothing;

insert into deliveries (id, tenant_id, order_id, supplier_id, carrier, tracking_no, status)
values
  ('dlv-demo', 'tenant-acme', 'po-demo', 'ent-supplier-sunrise', '顺丰速运', 'SF1234567890', '已发货')
on conflict (tenant_id, order_id) do nothing;
