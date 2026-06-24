-- 主流程固定审批模板（需求 / 供应商准入 / 定标）。提交审批需对应 active 模板。
-- 引用 tenant-acme + role-buyer-owner（V200 已建）。

insert into approval_templates (
  template_code, tenant_id, biz_type, name, default_approver_role_id, status, sort_order
)
values
  ('TPL_PURCHASE_DEMAND', 'tenant-acme', 'purchase_demand', '需求审批', 'role-buyer-owner', 'active', 10),
  ('TPL_SUPPLIER_ADMISSION', 'tenant-acme', 'buyer_supplier_admission', '供应商准入', 'role-buyer-owner', 'active', 20),
  ('TPL_RFQ_AWARD', 'tenant-acme', 'rfq_award', '定标审批', 'role-buyer-owner', 'active', 30)
on conflict (tenant_id, template_code) do nothing;
