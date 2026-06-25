-- 演示付款批次链:两张发票 → 两条付款申请 → 一个付款批次。
-- 执行记录由 listCurrentTenantPaymentBatches 的 refreshTenantFromPaymentRequests 自动生成。

-- 1) 给 po-demo 补一张发票(演示用,直接落库;另含税字段走默认)。
insert into invoices (id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status,
                      invoice_code, invoice_date, tax_rate)
values ('inv-batch-a', 'tenant-acme', 'ent-supplier-sunrise', 'po-demo', 46000.00, 'INV-2026-0002', '待付款',
        '144031909111', date '2026-07-03', 13.00)
on conflict (tenant_id, order_id) do nothing;

-- 2) 为 inv-demo 落一条三单匹配(三单匹配通过),使其付款申请可进入"待登记付款"。
insert into three_way_matches (id, tenant_id, invoice_id, supplier_id, order_id, order_amount,
                               receipt_status, invoice_amount, variance_amount, match_status,
                               blocking_reason, payment_readiness)
values ('twm-demo', 'tenant-acme', 'inv-demo', 'ent-supplier-sunrise', 'po-invoiced', 88000.00,
        '已收货', 88000.00, 0.00, '三单匹配通过', '订单、收货、发票一致', '可申请付款')
on conflict (tenant_id, invoice_id) do nothing;

-- 3) 两条付款申请,同属批次 PB-2026-0001。
insert into payment_requests (id, tenant_id, invoice_id, supplier_id, order_id, amount,
                              request_status, payment_batch_no, remark, created_by)
values
  ('preq-demo-a', 'tenant-acme', 'inv-demo', 'ent-supplier-sunrise', 'po-invoiced', 88000.00,
   '付款申请已通过', 'PB-2026-0001', '线缆采购验收合格,正常付款', 'user-buyer-owner'),
  ('preq-demo-b', 'tenant-acme', 'inv-batch-a', 'ent-supplier-sunrise', 'po-demo', 46000.00,
   '付款申请审批中', 'PB-2026-0001', '打印机采购,待财务审批', 'user-buyer-owner')
on conflict (tenant_id, invoice_id) do nothing;

-- 4) 付款批次抬头。
insert into payment_batches (id, tenant_id, payment_batch_no, supplier_id, request_count,
                             total_amount, approved_amount, batch_status, planned_payment_date)
values ('pb-demo', 'tenant-acme', 'PB-2026-0001', 'ent-supplier-sunrise', 2,
        134000.00, 88000.00, '待执行', date '2026-07-10')
on conflict (tenant_id, payment_batch_no) do nothing;
