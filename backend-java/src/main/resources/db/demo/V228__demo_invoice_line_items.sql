-- 为演示发票 inv-demo 补行项明细(由 po-invoiced 订单行项复制,合计 88000)。
insert into invoice_line_items
  (id, tenant_id, invoice_id, order_line_id, description, unit, quantity, unit_price, line_amount, sort_no)
values
  ('ili-demo-1a', 'tenant-acme', 'inv-demo', 'oli-inv-1a', '网络机柜（42U）', '台', 4, 12000.00, 48000.00, 0),
  ('ili-demo-1b', 'tenant-acme', 'inv-demo', 'oli-inv-1b', '六类综合布线', '米', 2000, 20.00, 40000.00, 1)
on conflict (id) do nothing;
