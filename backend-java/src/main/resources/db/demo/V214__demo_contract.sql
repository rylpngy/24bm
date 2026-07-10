-- 演示合同：由已收货订单 po-invoiced 生成，含合同期限/签订日期/付款条款/质保违约条款。
insert into contracts (
  id, tenant_id, contract_no, contract_name, related_order_id, supplier_id,
  amount, status, archive_status, fulfillment_progress, effective_date,
  sign_date, expiry_date, payment_terms, warranty_terms
)
values (
  'ctr-demo', 'tenant-acme', 'HT-2026-0001', '线缆采购框架合同', 'po-invoiced', 'ent-supplier-sunrise',
  88000.00, '已生效', '未归档', '同步中', date '2026-06-22',
  date '2026-06-20', date '2027-06-19',
  '验收合格后30个工作日内电汇支付，质保金为合同总额5%、质保期满后无息退还。',
  '质保期2年；逾期交付按每日合同总额0.5%计违约金，累计不超过10%；重大质量问题供应商负责退换并赔偿直接损失。'
)
on conflict (tenant_id, related_order_id) do nothing;
