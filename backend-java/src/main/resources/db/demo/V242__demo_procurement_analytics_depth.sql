-- 采购分析页演示数据补强:拉满 6 个月趋势、供应商 Top5 与订单状态分布。

insert into buyer_supplier_relations (id, tenant_id, supplier_id, status, level, categories, performance_score)
values
  ('rel-acme-newapply-analytics', 'tenant-acme', 'ent-supplier-newapply', '已准入', 'B', '["智能装备","自动化"]'::jsonb, 86.50)
on conflict (tenant_id, supplier_id) do update set
  status = excluded.status,
  level = excluded.level,
  categories = excluded.categories,
  performance_score = excluded.performance_score,
  updated_at = now();

insert into rfqs (id, tenant_id, title, status, deadline_at, owner_id, awarded_supplier_id,
                  quote_requirement, delivery_requirement, evaluation_method)
values
  ('rfq-analytics-jan', 'tenant-acme', '一月办公终端补采询价', '已定标',
   timestamptz '2026-01-18 18:00:00+08', 'user-buyer-owner', 'ent-supplier-tech',
   '含税到厂价,提供三年质保。', '分两批交付,首批 7 日内到货。', '综合评分'),
  ('rfq-analytics-feb', 'tenant-acme', '二月行政耗材集采询价', '已定标',
   timestamptz '2026-02-20 18:00:00+08', 'user-buyer-owner', 'ent-supplier-office',
   '按月滚动供货,报价含配送。', '华东仓直发,缺货提前 3 日通知。', '最低价'),
  ('rfq-analytics-mar', 'tenant-acme', '三月自动化备件采购', '已定标',
   timestamptz '2026-03-22 18:00:00+08', 'user-buyer-owner', 'ent-supplier-newapply',
   '提供原厂授权与备件清单。', '按项目节点到货。', '综合评分'),
  ('rfq-analytics-apr', 'tenant-acme', '四月网络改造材料询价', '已定标',
   timestamptz '2026-04-22 18:00:00+08', 'user-buyer-owner', 'ent-supplier-sunrise',
   '报价需拆分材料与施工辅料。', '一次性交付至张江园区。', '综合评分'),
  ('rfq-analytics-may', 'tenant-acme', '五月服务器维保服务采购', '已定标',
   timestamptz '2026-05-24 18:00:00+08', 'user-buyer-owner', 'ent-supplier-tech',
   '含驻场支持与季度巡检。', '服务期 12 个月。', '技术评分优先')
on conflict (id) do update set
  title = excluded.title,
  status = excluded.status,
  deadline_at = excluded.deadline_at,
  awarded_supplier_id = excluded.awarded_supplier_id,
  quote_requirement = excluded.quote_requirement,
  delivery_requirement = excluded.delivery_requirement,
  evaluation_method = excluded.evaluation_method,
  updated_at = now();

insert into quotes (id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status, submitted_at, round)
values
  ('quote-analytics-jan-win', 'tenant-acme', 'rfq-analytics-jan', 'ent-supplier-tech', 72000.00, 13.00, 10, '已提交', timestamptz '2026-01-15 10:00:00+08', 1),
  ('quote-analytics-jan-high', 'tenant-acme', 'rfq-analytics-jan', 'ent-supplier-sunrise', 79000.00, 13.00, 9, '已提交', timestamptz '2026-01-15 11:00:00+08', 1),
  ('quote-analytics-feb-win', 'tenant-acme', 'rfq-analytics-feb', 'ent-supplier-office', 38000.00, 13.00, 5, '已提交', timestamptz '2026-02-16 10:00:00+08', 1),
  ('quote-analytics-feb-high', 'tenant-acme', 'rfq-analytics-feb', 'ent-supplier-sunrise', 42500.00, 13.00, 4, '已提交', timestamptz '2026-02-16 11:00:00+08', 1),
  ('quote-analytics-mar-win', 'tenant-acme', 'rfq-analytics-mar', 'ent-supplier-newapply', 126000.00, 13.00, 18, '已提交', timestamptz '2026-03-18 10:00:00+08', 1),
  ('quote-analytics-mar-high', 'tenant-acme', 'rfq-analytics-mar', 'ent-supplier-tech', 138000.00, 13.00, 15, '已提交', timestamptz '2026-03-18 11:00:00+08', 1),
  ('quote-analytics-apr-win', 'tenant-acme', 'rfq-analytics-apr', 'ent-supplier-sunrise', 68000.00, 13.00, 12, '已提交', timestamptz '2026-04-16 10:00:00+08', 1),
  ('quote-analytics-apr-high', 'tenant-acme', 'rfq-analytics-apr', 'ent-supplier-office', 73500.00, 13.00, 14, '已提交', timestamptz '2026-04-16 11:00:00+08', 1),
  ('quote-analytics-may-win', 'tenant-acme', 'rfq-analytics-may', 'ent-supplier-tech', 98000.00, 6.00, 30, '已提交', timestamptz '2026-05-20 10:00:00+08', 1),
  ('quote-analytics-may-high', 'tenant-acme', 'rfq-analytics-may', 'ent-supplier-newapply', 109000.00, 6.00, 30, '已提交', timestamptz '2026-05-20 11:00:00+08', 1)
on conflict (tenant_id, rfq_id, supplier_id, round) do update set
  amount = excluded.amount,
  tax_rate = excluded.tax_rate,
  delivery_days = excluded.delivery_days,
  status = excluded.status,
  submitted_at = excluded.submitted_at,
  round = excluded.round;

insert into award_decisions (id, tenant_id, rfq_id, quote_id, supplier_id, amount, reason, approved_status, created_at)
values
  ('award-analytics-jan', 'tenant-acme', 'rfq-analytics-jan', 'quote-analytics-jan-win', 'ent-supplier-tech', 72000.00, '交付周期与维保承诺最优', '已通过', timestamptz '2026-01-17 10:00:00+08'),
  ('award-analytics-feb', 'tenant-acme', 'rfq-analytics-feb', 'quote-analytics-feb-win', 'ent-supplier-office', 38000.00, '价格最低且配送 SLA 满足要求', '已通过', timestamptz '2026-02-18 10:00:00+08'),
  ('award-analytics-mar', 'tenant-acme', 'rfq-analytics-mar', 'quote-analytics-mar-win', 'ent-supplier-newapply', 126000.00, '原厂授权完整,备件覆盖率高', '已通过', timestamptz '2026-03-20 10:00:00+08'),
  ('award-analytics-apr', 'tenant-acme', 'rfq-analytics-apr', 'quote-analytics-apr-win', 'ent-supplier-sunrise', 68000.00, '综合评分最优', '已通过', timestamptz '2026-04-18 10:00:00+08'),
  ('award-analytics-may', 'tenant-acme', 'rfq-analytics-may', 'quote-analytics-may-win', 'ent-supplier-tech', 98000.00, '技术服务响应最好', '已通过', timestamptz '2026-05-22 10:00:00+08')
on conflict (id) do update set
  quote_id = excluded.quote_id,
  supplier_id = excluded.supplier_id,
  amount = excluded.amount,
  reason = excluded.reason,
  approved_status = excluded.approved_status,
  created_at = excluded.created_at;

insert into purchase_orders (id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date,
                             created_at, delivery_address, contact_name, contact_phone, payment_terms)
values
  ('po-analytics-jan', 'tenant-acme', 'rfq-analytics-jan', 'ent-supplier-tech', 72000.00, '已收货',
   date '2026-01-28', timestamptz '2026-01-18 10:00:00+08', '上海市浦东新区张江路100号', '王收货', '021-58880000', '验收后30天内付款'),
  ('po-analytics-feb', 'tenant-acme', 'rfq-analytics-feb', 'ent-supplier-office', 38000.00, '已关闭',
   date '2026-02-28', timestamptz '2026-02-19 10:00:00+08', '上海市浦东新区张江路100号', '王收货', '021-58880000', '月结30天'),
  ('po-analytics-mar', 'tenant-acme', 'rfq-analytics-mar', 'ent-supplier-newapply', 126000.00, '已收货',
   date '2026-03-30', timestamptz '2026-03-21 10:00:00+08', '上海市浦东新区张江路100号', '王收货', '021-58880000', '项目验收后付款'),
  ('po-analytics-apr', 'tenant-acme', 'rfq-analytics-apr', 'ent-supplier-sunrise', 68000.00, '履约中',
   date '2026-04-30', timestamptz '2026-04-19 10:00:00+08', '上海市浦东新区张江路100号', '王收货', '021-58880000', '分阶段付款'),
  ('po-analytics-may', 'tenant-acme', 'rfq-analytics-may', 'ent-supplier-tech', 98000.00, '已发货',
   date '2026-05-30', timestamptz '2026-05-23 10:00:00+08', '上海市浦东新区张江路100号', '王收货', '021-58880000', '服务期内分期付款')
on conflict (id) do update set
  amount = excluded.amount,
  status = excluded.status,
  expected_receipt_date = excluded.expected_receipt_date,
  created_at = excluded.created_at,
  delivery_address = excluded.delivery_address,
  contact_name = excluded.contact_name,
  contact_phone = excluded.contact_phone,
  payment_terms = excluded.payment_terms,
  updated_at = now();
