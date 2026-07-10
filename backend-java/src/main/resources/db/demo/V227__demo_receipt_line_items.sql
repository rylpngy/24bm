-- 为演示已收货订单 po-invoiced 补订单行项(合计 88000)与对应的逐行验收明细。
insert into order_line_items
  (id, tenant_id, order_id, description, unit, quantity, unit_price, line_amount, sort_no)
values
  ('oli-inv-1a', 'tenant-acme', 'po-invoiced', '网络机柜（42U）', '台', 4, 12000.00, 48000.00, 0),
  ('oli-inv-1b', 'tenant-acme', 'po-invoiced', '六类综合布线', '米', 2000, 20.00, 40000.00, 1)
on conflict (id) do nothing;

-- 逐行验收:机柜全数合格;布线 2000 米中 1995 米合格(5 米端头压痕挑出)。
insert into receipt_line_items
  (id, tenant_id, receipt_id, order_line_id, description, unit,
   ordered_quantity, received_quantity, qualified_quantity, sort_no)
values
  ('rli-inv-1a', 'tenant-acme', 'rcpt-invoiced', 'oli-inv-1a', '网络机柜（42U）', '台', 4, 4, 4, 0),
  ('rli-inv-1b', 'tenant-acme', 'rcpt-invoiced', 'oli-inv-1b', '六类综合布线', '米', 2000, 2000, 1995, 1)
on conflict (id) do nothing;
