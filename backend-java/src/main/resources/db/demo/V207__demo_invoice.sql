-- S6 演示：一条已收货订单 + 发票(待付款)，供采购方付款与三单匹配演示。
-- 发票金额 = 订单金额(三单匹配一致)。

insert into purchase_demands (id, tenant_id, title, department_id, requester_id, budget, status)
values
  ('dem-demo-cable', 'tenant-acme', '网络线缆采购', 'dept-it', 'user-buyer-owner', 90000.00, '已通过')
on conflict (id) do nothing;

insert into rfqs (id, tenant_id, title, status, deadline_at, owner_id, awarded_supplier_id)
values
  ('rfq-invoiced', 'tenant-acme', '线缆询价(已定标)', '已定标',
   timestamptz '2026-06-10 18:00:00+08', 'user-buyer-owner', 'ent-supplier-sunrise')
on conflict (id) do nothing;

insert into rfq_demands (id, tenant_id, rfq_id, demand_id)
values ('rfqd-invoiced-1', 'tenant-acme', 'rfq-invoiced', 'dem-demo-cable')
on conflict (id) do nothing;

insert into rfq_invites (id, tenant_id, rfq_id, supplier_id, invite_status)
values ('rfqi-invoiced-1', 'tenant-acme', 'rfq-invoiced', 'ent-supplier-sunrise', '已邀请')
on conflict (tenant_id, rfq_id, supplier_id) do nothing;

-- 已收货订单 + 发货 + 收货事实。
insert into purchase_orders (id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date)
values
  ('po-invoiced', 'tenant-acme', 'rfq-invoiced', 'ent-supplier-sunrise', 88000.00, '已收货', date '2026-06-22')
on conflict (tenant_id, rfq_id, supplier_id) do nothing;

insert into deliveries (id, tenant_id, order_id, supplier_id, carrier, tracking_no, status)
values ('dlv-invoiced', 'tenant-acme', 'po-invoiced', 'ent-supplier-sunrise', '德邦物流', 'DB9876543210', '已发货')
on conflict (tenant_id, order_id) do nothing;

insert into receipts (id, tenant_id, order_id, receiver_id, result)
values ('rcpt-invoiced', 'tenant-acme', 'po-invoiced', 'user-buyer-owner', '验收合格')
on conflict (tenant_id, order_id) do nothing;

-- 发票：待付款，金额 = 订单金额。
insert into invoices (id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status)
values ('inv-demo', 'tenant-acme', 'ent-supplier-sunrise', 'po-invoiced', 88000.00, 'INV-2026-0001', '待付款')
on conflict (tenant_id, order_id) do nothing;
