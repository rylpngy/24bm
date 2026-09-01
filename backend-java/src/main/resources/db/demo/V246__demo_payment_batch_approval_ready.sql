-- PB-2026-0001 的两笔付款申请均已通过，演示基线应从批次审批入口继续。
update payment_batches
set approved_amount = total_amount,
    batch_status = '待提交审批',
    updated_at = now()
where tenant_id = 'tenant-acme'
  and payment_batch_no = 'PB-2026-0001'
  and batch_status = '待执行';
