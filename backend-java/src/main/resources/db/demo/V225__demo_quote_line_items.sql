-- 为演示报价补行项明细,行合计与各报价头金额一致(118000 / 125000)。
insert into quote_line_items
  (id, tenant_id, quote_id, description, unit, quantity, unit_price, line_amount, sort_no)
values
  ('qli-demo-1a', 'tenant-acme', 'quote-demo-1', '机架式服务器（2U 双路）', '台', 10, 9800.00, 98000.00, 0),
  ('qli-demo-1b', 'tenant-acme', 'quote-demo-1', '千兆三层交换机', '台', 8, 2500.00, 20000.00, 1),
  ('qli-demo-2a', 'tenant-acme', 'quote-demo-2', '机架式服务器（2U 双路）', '台', 10, 10500.00, 105000.00, 0),
  ('qli-demo-2b', 'tenant-acme', 'quote-demo-2', '千兆三层交换机', '台', 8, 2500.00, 20000.00, 1)
on conflict (id) do nothing;
