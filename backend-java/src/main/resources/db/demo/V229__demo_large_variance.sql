-- 演示差异分级审批:发票金额(95000)高于订单(80000)15000,超 ¥10,000 阈值 → 需财务经理签核。
insert into rfqs (id, tenant_id, title, status, deadline_at, owner_id, awarded_supplier_id)
values ('rfq-bigvar', 'tenant-acme', '大额差异演示询价(已定标)', '已定标',
        timestamptz '2026-06-20 18:00:00+08', 'user-buyer-owner', 'ent-supplier-sunrise')
on conflict (id) do nothing;

insert into purchase_orders (id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date,
                             delivery_address, contact_name, contact_phone, payment_terms)
values ('po-bigvar', 'tenant-acme', 'rfq-bigvar', 'ent-supplier-sunrise', 80000.00, '已收货', date '2026-06-22',
        '上海市浦东新区张江路100号', '王收货', '021-58880000', '货到验收30天内付款')
on conflict (id) do nothing;

insert into invoices (id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status,
                      invoice_code, invoice_date, tax_rate)
values ('inv-bigvar', 'tenant-acme', 'ent-supplier-sunrise', 'po-bigvar', 95000.00, 'INV-2026-BIG1', '待付款',
        '144031909555', date '2026-06-23', 13.00)
on conflict (tenant_id, order_id) do nothing;

insert into three_way_matches (id, tenant_id, invoice_id, supplier_id, order_id, order_amount,
                               receipt_status, invoice_amount, variance_amount, match_status,
                               blocking_reason, payment_readiness)
values ('twm-bigvar', 'tenant-acme', 'inv-bigvar', 'ent-supplier-sunrise', 'po-bigvar', 80000.00,
        '已收货', 95000.00, 15000.00, '金额差异',
        '发票金额超订单 15000(超分级审批阈值)', '需处理差异')
on conflict (tenant_id, invoice_id) do nothing;
