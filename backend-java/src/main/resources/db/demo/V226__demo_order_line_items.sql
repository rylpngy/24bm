-- 为演示订单 po-demo 补行项明细,行合计与订单头金额一致(32000 + 14000 = 46000)。
insert into order_line_items
  (id, tenant_id, order_id, description, unit, quantity, unit_price, line_amount, sort_no)
values
  ('oli-demo-1a', 'tenant-acme', 'po-demo', '激光打印机（A3 黑白）', '台', 4, 8000.00, 32000.00, 0),
  ('oli-demo-1b', 'tenant-acme', 'po-demo', '原装硒鼓', '个', 20, 700.00, 14000.00, 1)
on conflict (id) do nothing;
