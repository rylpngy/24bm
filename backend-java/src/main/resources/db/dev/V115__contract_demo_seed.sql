insert into purchase_demands (id, tenant_id, title, department_id, requester_id, budget, status)
values
  ('dem-local-laptop', 'tenant-acme', '本地联调办公电脑采购', 'dept-it', 'user-buyer-owner', 120000.00, '已通过')
on conflict (id) do update set
  title = excluded.title,
  department_id = excluded.department_id,
  requester_id = excluded.requester_id,
  budget = excluded.budget,
  status = excluded.status,
  updated_at = now();

insert into purchase_demand_items (id, tenant_id, demand_id, material_id, quantity)
values
  ('dem-local-laptop-item-1', 'tenant-acme', 'dem-local-laptop', 'mat-laptop', 10.0000)
on conflict (id) do nothing;

insert into rfqs (id, tenant_id, title, status, deadline_at, owner_id, awarded_supplier_id)
values
  ('rfq-local-laptop', 'tenant-acme', '本地联调办公电脑询价', '已定标', now() + interval '7 days', 'user-buyer-owner', 'ent-supplier-sunrise')
on conflict (id) do update set
  title = excluded.title,
  status = excluded.status,
  deadline_at = excluded.deadline_at,
  owner_id = excluded.owner_id,
  awarded_supplier_id = excluded.awarded_supplier_id,
  updated_at = now();

insert into rfq_demands (id, tenant_id, rfq_id, demand_id)
values
  ('rfq-local-laptop-dem-1', 'tenant-acme', 'rfq-local-laptop', 'dem-local-laptop')
on conflict (id) do nothing;

insert into rfq_invites (id, tenant_id, rfq_id, supplier_id, invite_status)
values
  ('rfq-local-laptop-invite-1', 'tenant-acme', 'rfq-local-laptop', 'ent-supplier-sunrise', '已邀请')
on conflict (tenant_id, rfq_id, supplier_id) do update set
  invite_status = excluded.invite_status;

insert into quotes (id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status)
values
  ('quote-local-laptop-1', 'tenant-acme', 'rfq-local-laptop', 'ent-supplier-sunrise', 60000.00, 13.00, 10, '已提交')
on conflict (tenant_id, rfq_id, supplier_id, round) do update set
  amount = excluded.amount,
  tax_rate = excluded.tax_rate,
  delivery_days = excluded.delivery_days,
  status = excluded.status;

insert into award_decisions (id, tenant_id, rfq_id, quote_id, supplier_id, amount, reason, approved_status)
values
  ('award-local-laptop-1', 'tenant-acme', 'rfq-local-laptop', 'quote-local-laptop-1', 'ent-supplier-sunrise', 60000.00, '本地联调合同台账示例', '已通过')
on conflict (id) do nothing;

insert into purchase_orders (id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date)
values
  ('po-acme-1', 'tenant-acme', 'rfq-local-laptop', 'ent-supplier-sunrise', 60000.00, '待收货', current_date + 14)
on conflict (id) do update set
  amount = excluded.amount,
  status = excluded.status,
  expected_receipt_date = excluded.expected_receipt_date,
  updated_at = now();

insert into invoices (id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status)
values
  ('inv-contract-demo-1', 'tenant-acme', 'ent-supplier-sunrise', 'po-acme-1', 60000.00, 'INV-CONTRACT-DEMO-1', '待付款')
on conflict (tenant_id, order_id) do update set
  amount = excluded.amount,
  invoice_no = excluded.invoice_no,
  payment_status = excluded.payment_status,
  updated_at = now();

insert into contracts (
  id, tenant_id, contract_no, contract_name, related_order_id, supplier_id,
  amount, status, archive_status, fulfillment_progress, effective_date
)
values
  ('contract-po-acme-1', 'tenant-acme', 'CTR-PO-ACME-1', '晨光科技供应商采购合同', 'po-acme-1', 'ent-supplier-sunrise',
   60000.00, '履约中', '未归档', '履约中', current_date)
on conflict (tenant_id, related_order_id) do update set
  contract_no = excluded.contract_no,
  contract_name = excluded.contract_name,
  supplier_id = excluded.supplier_id,
  amount = excluded.amount,
  status = excluded.status,
  archive_status = excluded.archive_status,
  fulfillment_progress = excluded.fulfillment_progress,
  effective_date = excluded.effective_date,
  updated_at = now();
