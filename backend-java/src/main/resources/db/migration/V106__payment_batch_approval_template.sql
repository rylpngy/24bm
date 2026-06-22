insert into approval_templates (
  template_code, tenant_id, biz_type, name, default_approver_role_id, status, sort_order
)
select 'TPL_PAYMENT_BATCH', t.id, 'payment_batch', '付款批次审批', 'role-buyer-owner', 'active', 50
from tenants t
where t.id = 'tenant-acme'
on conflict (tenant_id, template_code) do update
  set biz_type = excluded.biz_type,
      name = excluded.name,
      default_approver_role_id = excluded.default_approver_role_id,
      status = excluded.status,
      sort_order = excluded.sort_order,
      updated_at = now();
