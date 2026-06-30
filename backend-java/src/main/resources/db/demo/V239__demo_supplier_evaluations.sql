-- 演示:为 rfq-demo 报价供应商各补一期绩效,供「绩效联动定标」展示。
insert into supplier_evaluations
  (id, tenant_id, supplier_id, period, quality_score, delivery_score, price_score, service_score, total_score, suggested_tier, comment, evaluated_by)
values
  ('eval-demo-sunrise', 'tenant-acme', 'ent-supplier-sunrise', '2026-Q1', 92.0, 88.0, 85.0, 90.0, 89.0, 'A级(优选)', '交付稳定,质量优。', 'user-buyer-owner'),
  ('eval-demo-tech', 'tenant-acme', 'ent-supplier-tech', '2026-Q1', 78.0, 70.0, 88.0, 75.0, 77.5, 'B级(合格)', '价格有优势,交期偶有延迟。', 'user-buyer-owner')
on conflict (tenant_id, supplier_id, period) do nothing;
