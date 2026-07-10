-- 演示对账差异处理:发票金额(52000)与订单金额(50000)不一致 → 三单匹配金额差异。
insert into rfqs (id, tenant_id, title, status, deadline_at, owner_id, awarded_supplier_id)
values ('rfq-var', 'tenant-acme', '差异演示询价(已定标)', '已定标',
        timestamptz '2026-06-20 18:00:00+08', 'user-buyer-owner', 'ent-supplier-sunrise')
on conflict (id) do nothing;

insert into purchase_orders (id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date,
                             delivery_address, contact_name, contact_phone, payment_terms)
values ('po-var', 'tenant-acme', 'rfq-var', 'ent-supplier-sunrise', 50000.00, '已收货', date '2026-06-22',
        '上海市浦东新区张江路100号', '王收货', '021-58880000', '货到验收30天内付款')
on conflict (id) do nothing;

-- 发票金额高于订单 2000(差异)。
insert into invoices (id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status,
                      invoice_code, invoice_date, tax_rate)
values ('inv-var', 'tenant-acme', 'ent-supplier-sunrise', 'po-var', 52000.00, 'INV-2026-VAR1', '待付款',
        '144031909333', date '2026-06-23', 13.00)
on conflict (tenant_id, order_id) do nothing;

-- 三单匹配:金额差异,付款就绪=需处理差异。
insert into three_way_matches (id, tenant_id, invoice_id, supplier_id, order_id, order_amount,
                               receipt_status, invoice_amount, variance_amount, match_status,
                               blocking_reason, payment_readiness)
values ('twm-var', 'tenant-acme', 'inv-var', 'ent-supplier-sunrise', 'po-var', 50000.00,
        '已收货', 52000.00, 2000.00, '金额差异',
        '发票金额与订单金额不一致', '需处理差异')
on conflict (tenant_id, invoice_id) do nothing;
