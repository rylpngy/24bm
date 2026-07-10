delete from audit_logs
where tenant_id = 'tenant-stage7-platform-action'
   or target_id in (
    'tenant-stage7-platform-action',
    'ent-stage7-platform-review-ready',
    'announcement-stage7-platform-withdraw-ready'
  );

delete from platform_announcements
where id = 'announcement-stage7-platform-withdraw-ready'
   or title like '阶段七平台演示-真实发布公告%';

delete from supplier_enterprises
where enterprise_id = 'ent-stage7-platform-review-ready';

delete from enterprises
where id = 'ent-stage7-platform-review-ready';

delete from tenants
where id = 'tenant-stage7-platform-action';

delete from approval_tasks
where tenant_id = 'tenant-acme'
  and (biz_id in ('dem-stage7-submit-ready', 'dem-stage7-approval-pending', 'award-stage7-order-ready')
    or biz_id in (
      select id
      from award_decisions
      where tenant_id = 'tenant-acme'
        and rfq_id in ('rfq-stage7-award-ready', 'rfq-stage7-order-ready', 'rfq-stage7-receipt-ready')
    ));

delete from award_decisions
where tenant_id = 'tenant-acme'
  and rfq_id in ('rfq-stage7-award-ready', 'rfq-stage7-order-ready', 'rfq-stage7-receipt-ready');

delete from rfq_demands
where tenant_id = 'tenant-acme'
  and demand_id = 'dem-stage7-rfq-ready';

delete from purchase_orders
where tenant_id = 'tenant-acme'
  and rfq_id = 'rfq-stage7-order-ready'
  and supplier_id = 'ent-supplier-sunrise';

delete from receipts
where tenant_id = 'tenant-acme'
  and order_id = 'po-stage7-receipt-ready';

delete from three_way_matches
where tenant_id = 'tenant-acme'
  and (invoice_id in (
      'inv-stage7-payment-ready',
      'inv-stage7-supplier-receivable-ready'
    )
    or order_id in ('po-stage7-supplier-invoice-ready'));

delete from invoices
where tenant_id = 'tenant-acme'
  and id = 'inv-stage7-payment-ready';

delete from invoice_reconciliations
where tenant_id = 'tenant-acme'
  and (invoice_id in ('inv-stage7-supplier-receivable-ready')
    or order_id in ('po-stage7-supplier-invoice-ready'));

delete from invoices
where tenant_id = 'tenant-acme'
  and (id in ('inv-stage7-supplier-receivable-ready')
    or order_id in ('po-stage7-supplier-invoice-ready'));

delete from deliveries
where tenant_id = 'tenant-acme'
  and order_id in ('po-stage7-supplier-delivery-ready');

delete from purchase_orders
where tenant_id = 'tenant-acme'
  and id in (
    'po-stage7-supplier-confirm-ready',
    'po-stage7-supplier-delivery-ready',
    'po-stage7-supplier-invoice-ready',
    'po-stage7-supplier-receivable-ready'
  );

delete from award_decisions
where tenant_id = 'tenant-acme'
  and id in (
    'award-stage7-supplier-confirm-ready',
    'award-stage7-supplier-delivery-ready',
    'award-stage7-supplier-invoice-ready',
    'award-stage7-supplier-receivable-ready'
  );

delete from quotes
where tenant_id = 'tenant-acme'
  and (id in (
    'quote-stage7-supplier-confirm-ready-1',
    'quote-stage7-supplier-delivery-ready-1',
    'quote-stage7-supplier-invoice-ready-1',
    'quote-stage7-supplier-receivable-ready-1'
  ) or rfq_id = 'rfq-stage7-supplier-quote-ready');

delete from rfq_demands
where tenant_id = 'tenant-acme'
  and rfq_id in (
    'rfq-stage7-supplier-quote-ready',
    'rfq-stage7-supplier-confirm-ready',
    'rfq-stage7-supplier-delivery-ready',
    'rfq-stage7-supplier-invoice-ready',
    'rfq-stage7-supplier-receivable-ready'
  );

delete from rfq_invites
where tenant_id = 'tenant-acme'
  and rfq_id in (
    'rfq-stage7-supplier-quote-ready',
    'rfq-stage7-supplier-confirm-ready',
    'rfq-stage7-supplier-delivery-ready',
    'rfq-stage7-supplier-invoice-ready',
    'rfq-stage7-supplier-receivable-ready'
  );

insert into tenants (id, name, plan, status, enabled_features, user_limit)
values
  ('tenant-stage7-platform-action', '阶段七平台演示租户', 'MVP', 'active', '["order"]'::jsonb, 40)
on conflict (id) do update set
  name = excluded.name,
  plan = excluded.plan,
  status = excluded.status,
  enabled_features = excluded.enabled_features,
  user_limit = excluded.user_limit,
  updated_at = now();

insert into enterprises (id, name, type, industry, verified, created_at, updated_at)
values
  ('ent-stage7-platform-review-ready', '阶段七平台演示待审核供应商', 'supplier', '平台审核演示', false, now() + interval '40 minutes', now())
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  industry = excluded.industry,
  verified = excluded.verified,
  created_at = excluded.created_at,
  updated_at = now();

insert into supplier_enterprises (enterprise_id, credit_code, legal_person, verified_status, profile_status, review_comment, profile_confirmed, risk_confirmed)
values
  ('ent-stage7-platform-review-ready', '91310000STAGE7PLATFORM', '赵平台', 'pending', 'submitted', null, false, false)
on conflict (enterprise_id) do update set
  credit_code = excluded.credit_code,
  legal_person = excluded.legal_person,
  verified_status = excluded.verified_status,
  profile_status = excluded.profile_status,
  review_comment = excluded.review_comment,
  profile_confirmed = excluded.profile_confirmed,
  risk_confirmed = excluded.risk_confirmed;

insert into platform_announcements (id, title, content, audience, status, published_by, created_at)
values
  ('announcement-stage7-platform-withdraw-ready', '阶段七平台演示-可撤回公告', '这是一条用于平台端真实点击撤回演示的公告。', 'all', 'active', 'user-platform-admin', now() + interval '39 minutes')
on conflict (id) do update set
  title = excluded.title,
  content = excluded.content,
  audience = excluded.audience,
  status = excluded.status,
  published_by = excluded.published_by,
  created_at = excluded.created_at;

insert into purchase_demands (id, tenant_id, title, department_id, requester_id, budget, status, created_at, updated_at)
values
  ('dem-stage7-submit-ready', 'tenant-acme', '阶段七演示-可提交审批需求', 'dept-it', 'user-buyer-requester', 88000.00, '草稿', now() + interval '20 minutes', now()),
  ('dem-stage7-approval-pending', 'tenant-acme', '阶段七演示-待审批需求', 'dept-it', 'user-buyer-requester', 76000.00, '审批中', now() + interval '19 minutes', now()),
  ('dem-stage7-rfq-ready', 'tenant-acme', '阶段七演示-可创建询价需求', 'dept-it', 'user-buyer-requester', 69000.00, '已通过', now() + interval '18 minutes', now()),
  ('dem-stage7-award-ready', 'tenant-acme', '阶段七演示-可定标询价需求', 'dept-it', 'user-buyer-requester', 56000.00, '已通过', now() + interval '17 minutes', now()),
  ('dem-stage7-order-ready', 'tenant-acme', '阶段七演示-可生成订单需求', 'dept-it', 'user-buyer-requester', 54000.00, '已通过', now() + interval '16 minutes', now()),
  ('dem-stage7-receipt-ready', 'tenant-acme', '阶段七演示-可登记收货需求', 'dept-it', 'user-buyer-requester', 52000.00, '已通过', now() + interval '15 minutes', now())
on conflict (id) do update set
  title = excluded.title,
  department_id = excluded.department_id,
  requester_id = excluded.requester_id,
  budget = excluded.budget,
  status = excluded.status,
  created_at = excluded.created_at,
  updated_at = now();

insert into purchase_demand_items (id, tenant_id, demand_id, material_id, quantity)
values
  ('dem-stage7-submit-ready-item-1', 'tenant-acme', 'dem-stage7-submit-ready', 'mat-laptop', 6.0000),
  ('dem-stage7-approval-pending-item-1', 'tenant-acme', 'dem-stage7-approval-pending', 'mat-laptop', 5.0000),
  ('dem-stage7-rfq-ready-item-1', 'tenant-acme', 'dem-stage7-rfq-ready', 'mat-monitor', 20.0000),
  ('dem-stage7-award-ready-item-1', 'tenant-acme', 'dem-stage7-award-ready', 'mat-laptop', 4.0000),
  ('dem-stage7-order-ready-item-1', 'tenant-acme', 'dem-stage7-order-ready', 'mat-laptop', 4.0000),
  ('dem-stage7-receipt-ready-item-1', 'tenant-acme', 'dem-stage7-receipt-ready', 'mat-laptop', 4.0000)
on conflict (id) do nothing;

insert into approval_tasks (id, tenant_id, biz_type, biz_id, assignee_id, status, created_at, acted_at)
values
  ('approval-stage7-demand-pending', 'tenant-acme', 'purchase_demand', 'dem-stage7-approval-pending', 'user-buyer-owner', '待审批', now() + interval '19 minutes', null),
  ('approval-stage7-award-approved', 'tenant-acme', 'rfq_award', 'award-stage7-order-ready', 'user-buyer-owner', '已通过', now() + interval '16 minutes', now() + interval '16 minutes')
on conflict (id) do update set
  biz_type = excluded.biz_type,
  biz_id = excluded.biz_id,
  assignee_id = excluded.assignee_id,
  status = excluded.status,
  acted_at = excluded.acted_at,
  created_at = excluded.created_at;

insert into rfqs (id, tenant_id, title, status, deadline_at, owner_id, awarded_supplier_id, created_at, updated_at)
values
  ('rfq-stage7-award-ready', 'tenant-acme', '阶段七演示-可提交定标审批 RFQ', '报价中', now() + interval '10 days', 'user-buyer-owner', null, now() + interval '17 minutes', now()),
  ('rfq-stage7-order-ready', 'tenant-acme', '阶段七演示-可生成采购订单 RFQ', '已定标', now() + interval '9 days', 'user-buyer-owner', 'ent-supplier-sunrise', now() + interval '16 minutes', now()),
  ('rfq-stage7-receipt-ready', 'tenant-acme', '阶段七演示-可登记收货 RFQ', '已定标', now() + interval '8 days', 'user-buyer-owner', 'ent-supplier-sunrise', now() + interval '15 minutes', now())
on conflict (id) do update set
  title = excluded.title,
  status = excluded.status,
  deadline_at = excluded.deadline_at,
  owner_id = excluded.owner_id,
  awarded_supplier_id = excluded.awarded_supplier_id,
  created_at = excluded.created_at,
  updated_at = now();

insert into rfq_demands (id, tenant_id, rfq_id, demand_id)
values
  ('rfq-stage7-award-ready-dem-1', 'tenant-acme', 'rfq-stage7-award-ready', 'dem-stage7-award-ready'),
  ('rfq-stage7-order-ready-dem-1', 'tenant-acme', 'rfq-stage7-order-ready', 'dem-stage7-order-ready'),
  ('rfq-stage7-receipt-ready-dem-1', 'tenant-acme', 'rfq-stage7-receipt-ready', 'dem-stage7-receipt-ready')
on conflict (id) do update set
  rfq_id = excluded.rfq_id,
  demand_id = excluded.demand_id;

insert into rfq_invites (id, tenant_id, rfq_id, supplier_id, invite_status)
values
  ('rfq-stage7-award-ready-invite-1', 'tenant-acme', 'rfq-stage7-award-ready', 'ent-supplier-sunrise', '已邀请'),
  ('rfq-stage7-order-ready-invite-1', 'tenant-acme', 'rfq-stage7-order-ready', 'ent-supplier-sunrise', '已邀请'),
  ('rfq-stage7-receipt-ready-invite-1', 'tenant-acme', 'rfq-stage7-receipt-ready', 'ent-supplier-sunrise', '已邀请')
on conflict (tenant_id, rfq_id, supplier_id) do update set
  invite_status = excluded.invite_status;

insert into quotes (id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status, submitted_at)
values
  ('quote-stage7-award-ready-1', 'tenant-acme', 'rfq-stage7-award-ready', 'ent-supplier-sunrise', 53600.00, 13.00, 7, '已提交', now() + interval '17 minutes'),
  ('quote-stage7-order-ready-1', 'tenant-acme', 'rfq-stage7-order-ready', 'ent-supplier-sunrise', 52800.00, 13.00, 8, '已提交', now() + interval '16 minutes'),
  ('quote-stage7-receipt-ready-1', 'tenant-acme', 'rfq-stage7-receipt-ready', 'ent-supplier-sunrise', 51800.00, 13.00, 9, '已提交', now() + interval '15 minutes')
on conflict (tenant_id, rfq_id, supplier_id, round) do update set
  amount = excluded.amount,
  tax_rate = excluded.tax_rate,
  delivery_days = excluded.delivery_days,
  status = excluded.status,
  submitted_at = excluded.submitted_at;

insert into award_decisions (id, tenant_id, rfq_id, quote_id, supplier_id, amount, reason, approved_status, created_at)
values
  ('award-stage7-order-ready', 'tenant-acme', 'rfq-stage7-order-ready', 'quote-stage7-order-ready-1', 'ent-supplier-sunrise', 52800.00, '阶段七演示订单生成样本，定标审批已通过。', '已通过', now() + interval '16 minutes'),
  ('award-stage7-receipt-ready', 'tenant-acme', 'rfq-stage7-receipt-ready', 'quote-stage7-receipt-ready-1', 'ent-supplier-sunrise', 51800.00, '阶段七演示收货验收样本，订单已发货。', '已通过', now() + interval '15 minutes')
on conflict (id) do update set
  rfq_id = excluded.rfq_id,
  quote_id = excluded.quote_id,
  supplier_id = excluded.supplier_id,
  amount = excluded.amount,
  reason = excluded.reason,
  approved_status = excluded.approved_status,
  created_at = excluded.created_at;

insert into purchase_orders (id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at)
values
  ('po-stage7-receipt-ready', 'tenant-acme', 'rfq-stage7-receipt-ready', 'ent-supplier-sunrise', 51800.00, '已发货', current_date + 5, now() + interval '15 minutes', now())
on conflict (id) do update set
  amount = excluded.amount,
  status = excluded.status,
  expected_receipt_date = excluded.expected_receipt_date,
  created_at = excluded.created_at,
  updated_at = now();

insert into deliveries (id, tenant_id, order_id, supplier_id, carrier, tracking_no, status, created_at)
values
  ('delivery-stage7-receipt-ready', 'tenant-acme', 'po-stage7-receipt-ready', 'ent-supplier-sunrise', '顺丰速运', 'SF-STAGE7-RECEIPT', '已发货', now() + interval '15 minutes')
on conflict (tenant_id, order_id) do update set
  carrier = excluded.carrier,
  tracking_no = excluded.tracking_no,
  status = excluded.status,
  created_at = excluded.created_at;

insert into invoices (id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, created_at, updated_at)
values
  ('inv-stage7-payment-ready', 'tenant-acme', 'ent-supplier-sunrise', 'po-stage7-receipt-ready', 51800.00, 'INV-STAGE7-PAYMENT', '待付款', now() + interval '14 minutes', now())
on conflict (tenant_id, order_id) do update set
  id = excluded.id,
  supplier_id = excluded.supplier_id,
  amount = excluded.amount,
  invoice_no = excluded.invoice_no,
  payment_status = excluded.payment_status,
  created_at = excluded.created_at,
  updated_at = now();

insert into purchase_demands (id, tenant_id, title, department_id, requester_id, budget, status, created_at, updated_at)
values
  ('dem-stage7-supplier-quote-ready', 'tenant-acme', '阶段七供应商演示-可提交报价需求', 'dept-it', 'user-buyer-requester', 47000.00, '已通过', now() + interval '30 minutes', now()),
  ('dem-stage7-supplier-confirm-ready', 'tenant-acme', '阶段七供应商演示-待确认订单需求', 'dept-it', 'user-buyer-requester', 46000.00, '已通过', now() + interval '29 minutes', now()),
  ('dem-stage7-supplier-delivery-ready', 'tenant-acme', '阶段七供应商演示-待发货订单需求', 'dept-it', 'user-buyer-requester', 45000.00, '已通过', now() + interval '28 minutes', now()),
  ('dem-stage7-supplier-invoice-ready', 'tenant-acme', '阶段七供应商演示-待开票订单需求', 'dept-it', 'user-buyer-requester', 44000.00, '已通过', now() + interval '27 minutes', now()),
  ('dem-stage7-supplier-receivable-ready', 'tenant-acme', '阶段七供应商演示-待应收备注需求', 'dept-it', 'user-buyer-requester', 43000.00, '已通过', now() + interval '26 minutes', now())
on conflict (id) do update set
  title = excluded.title,
  department_id = excluded.department_id,
  requester_id = excluded.requester_id,
  budget = excluded.budget,
  status = excluded.status,
  created_at = excluded.created_at,
  updated_at = now();

insert into purchase_demand_items (id, tenant_id, demand_id, material_id, quantity)
values
  ('dem-stage7-supplier-quote-ready-item-1', 'tenant-acme', 'dem-stage7-supplier-quote-ready', 'mat-laptop', 3.0000),
  ('dem-stage7-supplier-confirm-ready-item-1', 'tenant-acme', 'dem-stage7-supplier-confirm-ready', 'mat-laptop', 3.0000),
  ('dem-stage7-supplier-delivery-ready-item-1', 'tenant-acme', 'dem-stage7-supplier-delivery-ready', 'mat-monitor', 12.0000),
  ('dem-stage7-supplier-invoice-ready-item-1', 'tenant-acme', 'dem-stage7-supplier-invoice-ready', 'mat-monitor', 11.0000),
  ('dem-stage7-supplier-receivable-ready-item-1', 'tenant-acme', 'dem-stage7-supplier-receivable-ready', 'mat-laptop', 2.0000)
on conflict (id) do nothing;

insert into rfqs (id, tenant_id, title, status, deadline_at, owner_id, awarded_supplier_id, created_at, updated_at)
values
  ('rfq-stage7-supplier-quote-ready', 'tenant-acme', '阶段七供应商演示-可提交报价 RFQ', '报价中', now() + interval '10 days', 'user-buyer-owner', null, now() + interval '30 minutes', now()),
  ('rfq-stage7-supplier-confirm-ready', 'tenant-acme', '阶段七供应商演示-待确认订单 RFQ', '已定标', now() + interval '9 days', 'user-buyer-owner', 'ent-supplier-sunrise', now() + interval '29 minutes', now()),
  ('rfq-stage7-supplier-delivery-ready', 'tenant-acme', '阶段七供应商演示-待发货订单 RFQ', '已定标', now() + interval '8 days', 'user-buyer-owner', 'ent-supplier-sunrise', now() + interval '28 minutes', now()),
  ('rfq-stage7-supplier-invoice-ready', 'tenant-acme', '阶段七供应商演示-待开票订单 RFQ', '已定标', now() + interval '7 days', 'user-buyer-owner', 'ent-supplier-sunrise', now() + interval '27 minutes', now()),
  ('rfq-stage7-supplier-receivable-ready', 'tenant-acme', '阶段七供应商演示-待应收备注 RFQ', '已定标', now() + interval '6 days', 'user-buyer-owner', 'ent-supplier-sunrise', now() + interval '26 minutes', now())
on conflict (id) do update set
  title = excluded.title,
  status = excluded.status,
  deadline_at = excluded.deadline_at,
  owner_id = excluded.owner_id,
  awarded_supplier_id = excluded.awarded_supplier_id,
  created_at = excluded.created_at,
  updated_at = now();

insert into rfq_demands (id, tenant_id, rfq_id, demand_id)
values
  ('rfq-stage7-supplier-quote-ready-dem-1', 'tenant-acme', 'rfq-stage7-supplier-quote-ready', 'dem-stage7-supplier-quote-ready'),
  ('rfq-stage7-supplier-confirm-ready-dem-1', 'tenant-acme', 'rfq-stage7-supplier-confirm-ready', 'dem-stage7-supplier-confirm-ready'),
  ('rfq-stage7-supplier-delivery-ready-dem-1', 'tenant-acme', 'rfq-stage7-supplier-delivery-ready', 'dem-stage7-supplier-delivery-ready'),
  ('rfq-stage7-supplier-invoice-ready-dem-1', 'tenant-acme', 'rfq-stage7-supplier-invoice-ready', 'dem-stage7-supplier-invoice-ready'),
  ('rfq-stage7-supplier-receivable-ready-dem-1', 'tenant-acme', 'rfq-stage7-supplier-receivable-ready', 'dem-stage7-supplier-receivable-ready')
on conflict (id) do update set
  rfq_id = excluded.rfq_id,
  demand_id = excluded.demand_id;

insert into rfq_invites (id, tenant_id, rfq_id, supplier_id, invite_status)
values
  ('rfq-stage7-supplier-quote-ready-invite-1', 'tenant-acme', 'rfq-stage7-supplier-quote-ready', 'ent-supplier-sunrise', '已邀请'),
  ('rfq-stage7-supplier-confirm-ready-invite-1', 'tenant-acme', 'rfq-stage7-supplier-confirm-ready', 'ent-supplier-sunrise', '已邀请'),
  ('rfq-stage7-supplier-delivery-ready-invite-1', 'tenant-acme', 'rfq-stage7-supplier-delivery-ready', 'ent-supplier-sunrise', '已邀请'),
  ('rfq-stage7-supplier-invoice-ready-invite-1', 'tenant-acme', 'rfq-stage7-supplier-invoice-ready', 'ent-supplier-sunrise', '已邀请'),
  ('rfq-stage7-supplier-receivable-ready-invite-1', 'tenant-acme', 'rfq-stage7-supplier-receivable-ready', 'ent-supplier-sunrise', '已邀请')
on conflict (tenant_id, rfq_id, supplier_id) do update set
  invite_status = excluded.invite_status;

insert into quotes (id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status, submitted_at)
values
  ('quote-stage7-supplier-confirm-ready-1', 'tenant-acme', 'rfq-stage7-supplier-confirm-ready', 'ent-supplier-sunrise', 45200.00, 13.00, 8, '已提交', now() + interval '29 minutes'),
  ('quote-stage7-supplier-delivery-ready-1', 'tenant-acme', 'rfq-stage7-supplier-delivery-ready', 'ent-supplier-sunrise', 44200.00, 13.00, 7, '已提交', now() + interval '28 minutes'),
  ('quote-stage7-supplier-invoice-ready-1', 'tenant-acme', 'rfq-stage7-supplier-invoice-ready', 'ent-supplier-sunrise', 43200.00, 13.00, 6, '已提交', now() + interval '27 minutes'),
  ('quote-stage7-supplier-receivable-ready-1', 'tenant-acme', 'rfq-stage7-supplier-receivable-ready', 'ent-supplier-sunrise', 42200.00, 13.00, 5, '已提交', now() + interval '26 minutes')
on conflict (tenant_id, rfq_id, supplier_id, round) do update set
  amount = excluded.amount,
  tax_rate = excluded.tax_rate,
  delivery_days = excluded.delivery_days,
  status = excluded.status,
  submitted_at = excluded.submitted_at;

insert into award_decisions (id, tenant_id, rfq_id, quote_id, supplier_id, amount, reason, approved_status, created_at)
values
  ('award-stage7-supplier-confirm-ready', 'tenant-acme', 'rfq-stage7-supplier-confirm-ready', 'quote-stage7-supplier-confirm-ready-1', 'ent-supplier-sunrise', 45200.00, '阶段七供应商演示待确认订单样本。', '已通过', now() + interval '29 minutes'),
  ('award-stage7-supplier-delivery-ready', 'tenant-acme', 'rfq-stage7-supplier-delivery-ready', 'quote-stage7-supplier-delivery-ready-1', 'ent-supplier-sunrise', 44200.00, '阶段七供应商演示待发货订单样本。', '已通过', now() + interval '28 minutes'),
  ('award-stage7-supplier-invoice-ready', 'tenant-acme', 'rfq-stage7-supplier-invoice-ready', 'quote-stage7-supplier-invoice-ready-1', 'ent-supplier-sunrise', 43200.00, '阶段七供应商演示待开票订单样本。', '已通过', now() + interval '27 minutes'),
  ('award-stage7-supplier-receivable-ready', 'tenant-acme', 'rfq-stage7-supplier-receivable-ready', 'quote-stage7-supplier-receivable-ready-1', 'ent-supplier-sunrise', 42200.00, '阶段七供应商演示待应收备注样本。', '已通过', now() + interval '26 minutes')
on conflict (id) do update set
  rfq_id = excluded.rfq_id,
  quote_id = excluded.quote_id,
  supplier_id = excluded.supplier_id,
  amount = excluded.amount,
  reason = excluded.reason,
  approved_status = excluded.approved_status,
  created_at = excluded.created_at;

insert into purchase_orders (id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at)
values
  ('po-stage7-supplier-confirm-ready', 'tenant-acme', 'rfq-stage7-supplier-confirm-ready', 'ent-supplier-sunrise', 45200.00, '待供应商确认', current_date + 7, now() + interval '29 minutes', now()),
  ('po-stage7-supplier-delivery-ready', 'tenant-acme', 'rfq-stage7-supplier-delivery-ready', 'ent-supplier-sunrise', 44200.00, '待发货', current_date + 6, now() + interval '28 minutes', now()),
  ('po-stage7-supplier-invoice-ready', 'tenant-acme', 'rfq-stage7-supplier-invoice-ready', 'ent-supplier-sunrise', 43200.00, '已收货', current_date + 5, now() + interval '27 minutes', now()),
  ('po-stage7-supplier-receivable-ready', 'tenant-acme', 'rfq-stage7-supplier-receivable-ready', 'ent-supplier-sunrise', 42200.00, '已收货', current_date + 4, now() + interval '26 minutes', now())
on conflict (id) do update set
  amount = excluded.amount,
  status = excluded.status,
  expected_receipt_date = excluded.expected_receipt_date,
  created_at = excluded.created_at,
  updated_at = now();

insert into invoices (id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, reconciliation_note, created_at, updated_at)
values
  ('inv-stage7-supplier-receivable-ready', 'tenant-acme', 'ent-supplier-sunrise', 'po-stage7-supplier-receivable-ready', 42200.00, 'INV-STAGE7-SUPPLIER-RECEIVABLE', '待付款', null, now() + interval '26 minutes', now())
on conflict (tenant_id, order_id) do update set
  id = excluded.id,
  supplier_id = excluded.supplier_id,
  amount = excluded.amount,
  invoice_no = excluded.invoice_no,
  payment_status = excluded.payment_status,
  reconciliation_note = excluded.reconciliation_note,
  created_at = excluded.created_at,
  updated_at = now();

insert into invoice_reconciliations (id, tenant_id, invoice_id, supplier_id, order_id, stage, next_action)
values
  ('recon-stage7-supplier-receivable-ready', 'tenant-acme', 'inv-stage7-supplier-receivable-ready', 'ent-supplier-sunrise', 'po-stage7-supplier-receivable-ready', '三单匹配通过', '等待付款')
on conflict (id) do update set
  invoice_id = excluded.invoice_id,
  supplier_id = excluded.supplier_id,
  order_id = excluded.order_id,
  stage = excluded.stage,
  next_action = excluded.next_action;
