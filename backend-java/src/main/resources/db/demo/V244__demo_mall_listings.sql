-- 商城货架演示数据:已准入供应商的协议价商品(在架 + 一条下架样例)。
insert into mall_listings (id, tenant_id, supplier_id, material_id, price, unit, status)
values
  ('mall-demo-laptop',  'tenant-acme', 'ent-supplier-sunrise', 'mat-laptop',  5680.00, '台', '在架'),
  ('mall-demo-monitor', 'tenant-acme', 'ent-supplier-sunrise', 'mat-monitor', 1080.00, '台', '在架'),
  ('mall-demo-cable',   'tenant-acme', 'ent-supplier-tech',    'mat-cable',    788.00, '箱', '在架'),
  ('mall-demo-server',  'tenant-acme', 'ent-supplier-tech',    'mat-server', 45800.00, '台', '下架')
on conflict (tenant_id, supplier_id, material_id) do nothing;
