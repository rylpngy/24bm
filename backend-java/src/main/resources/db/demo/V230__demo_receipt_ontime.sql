-- 让演示收货单 rcpt-invoiced 准时(收货日 ≤ 预计到货 2026-06-22),
-- 使供应商实测交付分(准时率)展示有意义的非零值。
update receipts
set received_at = timestamptz '2026-06-21 10:00:00+08'
where tenant_id = 'tenant-acme' and id = 'rcpt-invoiced';
