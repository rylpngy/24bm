-- 财务链审批模板(付款申请 / 付款批次 / 付款归档异常)。
-- 正式迁移 V103/V106/V111 依赖 tenants 表已有 tenant-acme,但干净库上 demo 租户
-- 在 V200 才创建,导致这些模板在 migration+demo 组合下缺失;此处按 demo 口径补齐。

insert into approval_templates (
  template_code, tenant_id, biz_type, name, default_approver_role_id, status, sort_order
)
values
  ('TPL_PAYMENT_REQUEST', 'tenant-acme', 'payment_request', '付款申请审批', 'role-buyer-owner', 'active', 40),
  ('TPL_PAYMENT_BATCH', 'tenant-acme', 'payment_batch', '付款批次审批', 'role-buyer-owner', 'active', 50),
  ('TPL_PAYMENT_ARCHIVE_EXCEPTION', 'tenant-acme', 'payment_archive_exception', '付款归档异常审批', 'role-buyer-owner', 'active', 60)
on conflict (tenant_id, template_code) do nothing;
