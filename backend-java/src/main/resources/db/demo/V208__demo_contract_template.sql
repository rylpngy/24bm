-- 合同审批模板（提交合同审批所需）。

insert into approval_templates (
  template_code, tenant_id, biz_type, name, default_approver_role_id, status, sort_order
)
values
  ('TPL_CONTRACT_APPROVAL', 'tenant-acme', 'contract_approval', '合同审批', 'role-buyer-owner', 'active', 40)
on conflict (tenant_id, template_code) do nothing;
