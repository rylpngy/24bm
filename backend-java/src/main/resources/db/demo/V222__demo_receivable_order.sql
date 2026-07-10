-- 演示供应商开票:一笔已收货、尚未开票的订单(供应商可在门户开具发票)。
insert into rfqs (id, tenant_id, title, status, deadline_at, owner_id, awarded_supplier_id)
values ('rfq-newinv', 'tenant-acme', '耗材补充询价(已定标)', '已定标',
        timestamptz '2026-06-25 18:00:00+08', 'user-buyer-owner', 'ent-supplier-sunrise')
on conflict (id) do nothing;

insert into purchase_orders (id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date,
                             delivery_address, contact_name, contact_phone, payment_terms)
values ('po-newinv', 'tenant-acme', 'rfq-newinv', 'ent-supplier-sunrise', 30000.00, '已收货',
        date '2026-06-24', '上海市浦东新区张江路100号', '王收货', '021-58880000', '货到验收30天内付款')
on conflict (id) do nothing;
