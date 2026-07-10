-- 采购分析演示:补一笔定标(节支)与第二家供应商的多月订单,使集中度<100%、节支>0、趋势多月。

-- rfq-demo 定标:中标晨光 118000,最高报价 125000 → 比价节支 7000。
insert into award_decisions (id, tenant_id, rfq_id, quote_id, supplier_id, amount, reason, approved_status)
values ('award-demo', 'tenant-acme', 'rfq-demo', 'quote-demo-1', 'ent-supplier-sunrise',
        118000.00, '综合评分最优', '已通过')
on conflict (id) do nothing;

-- 第二家供应商(星联数码)历史订单,跨 4/5 月,分散供应商集中度与月度趋势。
-- 用不同 rfq 以满足 (tenant, rfq, supplier) 唯一约束。
insert into purchase_orders (id, tenant_id, rfq_id, supplier_id, amount, status,
                             expected_receipt_date, created_at)
values
  ('po-tech-1', 'tenant-acme', 'rfq-fulfilled', 'ent-supplier-tech', 60000.00, '已收货',
   date '2026-05-20', timestamptz '2026-05-10 10:00:00+08'),
  ('po-tech-2', 'tenant-acme', 'rfq-invoiced', 'ent-supplier-tech', 40000.00, '已发货',
   date '2026-04-25', timestamptz '2026-04-08 10:00:00+08')
on conflict (id) do nothing;
