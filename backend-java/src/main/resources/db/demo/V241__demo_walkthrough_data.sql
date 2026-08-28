-- 走查演示数据补强:补齐详情页、审批流、付款异常与合同履约中容易为空的明细表。

-- 1) 物料主数据与采购需求行项。
insert into materials (id, tenant_id, code, name, category, unit, reference_price, specification, brand, tax_rate, description)
values
  ('mat-server', 'tenant-acme', 'IT-SERVER', '机架式服务器', 'IT基础设施', '台', 48000.00,
   '2U/双路CPU/256G内存/8T企业盘', '浪潮', 13.00, '用于核心业务系统扩容与灾备节点建设。'),
  ('mat-printer', 'tenant-acme', 'OA-PRINTER', '激光打印机', '办公设备', '台', 3200.00,
   'A4黑白双面/网络打印', '惠普', 13.00, '行政办公区域共用打印设备。'),
  ('mat-cable', 'tenant-acme', 'NET-CABLE-CAT6', '六类网络线缆', '网络材料', '箱', 850.00,
   'CAT6/305米/蓝色', '普天', 13.00, '机房与办公区网络改造耗材。'),
  ('mat-audit-service', 'tenant-acme', 'FIN-AUDIT-SVC', '年度审计服务', '专业服务', '项', 80000.00,
   '年度财报审计+专项内控检查', '德勤', 6.00, '覆盖年度财务报表、内控抽样与整改建议。'),
  ('mat-finance-saas', 'tenant-acme', 'FIN-SOFT-SUB', '财务软件订阅', 'SaaS软件', '年', 45000.00,
   '100账号/电子档案/银企直连', '用友', 6.00, '财务共享与电子会计档案年度订阅。')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  unit = excluded.unit,
  reference_price = excluded.reference_price,
  specification = excluded.specification,
  brand = excluded.brand,
  tax_rate = excluded.tax_rate,
  description = excluded.description;

insert into purchase_demand_items (id, tenant_id, demand_id, material_id, quantity)
values
  ('demitem-laptop-1', 'tenant-acme', 'dem-demo-laptop', 'mat-laptop', 20),
  ('demitem-monitor-1', 'tenant-acme', 'dem-demo-monitor', 'mat-monitor', 30),
  ('demitem-server-1', 'tenant-acme', 'dem-demo-server', 'mat-server', 4),
  ('demitem-printer-1', 'tenant-acme', 'dem-demo-printer', 'mat-printer', 15),
  ('demitem-cable-1', 'tenant-acme', 'dem-demo-cable', 'mat-cable', 100),
  ('demitem-fin-audit-1', 'tenant-acme', 'dem-demo-fin-audit', 'mat-audit-service', 1),
  ('demitem-fin-soft-1', 'tenant-acme', 'dem-demo-fin-soft', 'mat-finance-saas', 1)
on conflict (id) do update set
  material_id = excluded.material_id,
  quantity = excluded.quantity;

-- 2) 补第二条合同:临近到期,用于续签提醒与合同付款对账。
insert into contracts (
  id, tenant_id, contract_no, contract_name, related_order_id, supplier_id,
  amount, status, archive_status, fulfillment_progress, effective_date,
  sign_date, expiry_date, payment_terms, warranty_terms, renewal_status
)
values (
  'ctr-printer', 'tenant-acme', 'HT-2026-0002', '打印机采购及维护合同', 'po-demo', 'ent-supplier-sunrise',
  46000.00, '已生效', '未归档', '同步中', date '2026-06-25',
  date '2026-06-24', date '2026-08-15',
  '验收后支付70%,上线稳定运行30日后支付尾款30%。',
  '整机质保1年,关键部件更换响应不超过2个工作日。',
  null
)
on conflict (tenant_id, related_order_id) do update set
  contract_no = excluded.contract_no,
  contract_name = excluded.contract_name,
  amount = excluded.amount,
  status = excluded.status,
  archive_status = excluded.archive_status,
  fulfillment_progress = excluded.fulfillment_progress,
  effective_date = excluded.effective_date,
  sign_date = excluded.sign_date,
  expiry_date = excluded.expiry_date,
  payment_terms = excluded.payment_terms,
  warranty_terms = excluded.warranty_terms;

insert into contract_payment_milestones
  (id, tenant_id, contract_id, name, percent, amount, status, sort_no, paid_at, reached, reached_at)
values
  ('milestone-printer-advance', 'tenant-acme', 'ctr-printer', '验收款', 70, 32200.00, '已付', 0,
   timestamptz '2026-07-01 15:30:00+08', true, timestamptz '2026-06-30 11:00:00+08'),
  ('milestone-printer-final', 'tenant-acme', 'ctr-printer', '尾款', 30, 13800.00, '待付', 1,
   null, true, timestamptz '2026-07-03 10:15:00+08')
on conflict (id) do update set
  status = excluded.status,
  paid_at = excluded.paid_at,
  reached = excluded.reached,
  reached_at = excluded.reached_at;

update contract_payment_milestones
set reached = true, reached_at = timestamptz '2026-07-02 09:00:00+08'
where id = 'milestone-47a0f1ee-7e7a-49a5-8d5f-7e80b260dd97';

insert into contract_fulfillment_events
  (id, tenant_id, contract_id, action_type, target_id, summary, source_label, created_by, created_at)
values
  ('ctrevent-demo-order', 'tenant-acme', 'ctr-demo', '订单同步', 'po-invoiced',
   '合同已关联采购订单 po-invoiced,同步订单金额与供应商信息。', '采购订单', 'user-buyer-owner',
   timestamptz '2026-06-20 14:20:00+08'),
  ('ctrevent-demo-receipt', 'tenant-acme', 'ctr-demo', '收货同步', 'rcpt-invoiced',
   '线缆到货并完成验收,触发验收款里程碑达成。', '收货验收', 'user-buyer-zhang',
   timestamptz '2026-06-21 10:30:00+08'),
  ('ctrevent-printer-payment', 'tenant-acme', 'ctr-printer', '付款登记', 'PB-2026-0001',
   '打印机采购进入付款批次 PB-2026-0001,尾款待登记。', '付款批次', 'user-buyer-li',
   timestamptz '2026-07-04 16:00:00+08')
on conflict (id) do update set
  summary = excluded.summary,
  source_label = excluded.source_label,
  created_at = excluded.created_at;

insert into contract_amendments
  (id, tenant_id, contract_id, seq, change_type, old_amount, new_amount,
   old_expiry_date, new_expiry_date, reason, actor_id, created_at)
values
  ('ctramend-demo-terms', 'tenant-acme', 'ctr-demo', 1, '条款变更', null, null,
   null, null, '补充约定到货批次拆分与质量复验流程。', 'user-buyer-owner',
   timestamptz '2026-06-25 09:30:00+08'),
  ('ctramend-printer-date', 'tenant-acme', 'ctr-printer', 1, '工期变更', null, null,
   date '2026-07-31', date '2026-08-15', '供应商追加维护培训,服务期顺延15日。', 'user-buyer-owner',
   timestamptz '2026-07-02 11:20:00+08')
on conflict (tenant_id, contract_id, seq) do update set
  change_type = excluded.change_type,
  old_amount = excluded.old_amount,
  new_amount = excluded.new_amount,
  old_expiry_date = excluded.old_expiry_date,
  new_expiry_date = excluded.new_expiry_date,
  reason = excluded.reason,
  actor_id = excluded.actor_id,
  created_at = excluded.created_at;

-- 3) 付款异常、三单差异处理与发票对账明细。
insert into invoice_reconciliations
  (id, tenant_id, invoice_id, supplier_id, order_id, stage, next_action, created_at, updated_at)
values
  ('recon-inv-demo', 'tenant-acme', 'inv-demo', 'ent-supplier-sunrise', 'po-invoiced',
   '三单匹配通过', '进入付款申请与付款批次登记', timestamptz '2026-06-23 09:30:00+08', now()),
  ('recon-inv-var', 'tenant-acme', 'inv-var', 'ent-supplier-sunrise', 'po-var',
   '金额差异待处理', '登记差异原因并提交财务经理签核', timestamptz '2026-06-24 10:00:00+08', now()),
  ('recon-inv-bigvar', 'tenant-acme', 'inv-bigvar', 'ent-supplier-sunrise', 'po-bigvar',
   '大额差异待签核', '核对供应商补差说明,超阈值需财务经理签核', timestamptz '2026-06-24 10:10:00+08', now())
on conflict (tenant_id, invoice_id) do update set
  stage = excluded.stage,
  next_action = excluded.next_action,
  updated_at = now();

insert into variance_handlings
  (id, tenant_id, invoice_id, supplier_id, order_id, variance_amount, reason,
   owner_id, result, status, created_by, created_at, updated_at, order_line_id, line_description)
values
  ('varhandle-inv-var', 'tenant-acme', 'inv-var', 'ent-supplier-sunrise', 'po-var', 2000.00,
   '供应商发票包含补充安装辅材,需采购确认是否纳入本订单结算。', 'user-buyer-li',
   '待采购确认差异归因', '待处理', 'user-buyer-li', timestamptz '2026-06-24 10:30:00+08', now(),
   null, null),
  ('varhandle-inv-bigvar', 'tenant-acme', 'inv-bigvar', 'ent-supplier-sunrise', 'po-bigvar', 15000.00,
   '发票金额超订单15000元,需走大额差异签核。', 'user-buyer-li',
   '已核对供应商补差说明,待财务经理最终签核。', '待财务经理签核', 'user-buyer-li',
   timestamptz '2026-06-24 10:40:00+08', now(), null, null)
on conflict (tenant_id, invoice_id) do update set
  variance_amount = excluded.variance_amount,
  reason = excluded.reason,
  owner_id = excluded.owner_id,
  result = excluded.result,
  status = excluded.status,
  updated_at = now(),
  order_line_id = excluded.order_line_id,
  line_description = excluded.line_description;

insert into payment_requests (id, tenant_id, invoice_id, supplier_id, order_id, amount,
                              request_status, payment_batch_no, remark, created_by)
values
  ('preq-var', 'tenant-acme', 'inv-var', 'ent-supplier-sunrise', 'po-var', 52000.00,
   '付款申请已通过', 'PB-2026-0002', '发票存在小额差异,需核实后登记付款。', 'user-buyer-li'),
  ('preq-bigvar', 'tenant-acme', 'inv-bigvar', 'ent-supplier-sunrise', 'po-bigvar', 95000.00,
   '付款申请已通过', 'PB-2026-0002', '大额差异待财务经理签核。', 'user-buyer-li')
on conflict (tenant_id, invoice_id) do update set
  amount = excluded.amount,
  request_status = excluded.request_status,
  payment_batch_no = excluded.payment_batch_no,
  remark = excluded.remark,
  updated_at = now();

insert into payment_batches (id, tenant_id, payment_batch_no, supplier_id, request_count,
                             total_amount, approved_amount, batch_status, planned_payment_date)
values ('pb-variance', 'tenant-acme', 'PB-2026-0002', 'ent-supplier-sunrise', 2,
        147000.00, 147000.00, '存在阻断', date '2026-07-12')
on conflict (tenant_id, payment_batch_no) do update set
  request_count = excluded.request_count,
  total_amount = excluded.total_amount,
  approved_amount = excluded.approved_amount,
  batch_status = excluded.batch_status,
  planned_payment_date = excluded.planned_payment_date,
  updated_at = now();

insert into payment_execution_records
  (id, tenant_id, payment_batch_no, payment_request_id, invoice_id, supplier_id,
   registered_amount, planned_payment_date, execution_status, execution_trace,
   execution_block_reason, release_evidence_no, release_remark, created_by, created_at, updated_at)
values
  ('payexec-var', 'tenant-acme', 'PB-2026-0002', 'preq-var', 'inv-var', 'ent-supplier-sunrise',
   0.00, date '2026-07-12', '暂不可登记', '三单金额差异未处理,暂不可登记付款',
   '差异未处理', null, null, 'user-buyer-li', now(), now()),
  ('payexec-bigvar', 'tenant-acme', 'PB-2026-0002', 'preq-bigvar', 'inv-bigvar', 'ent-supplier-sunrise',
   0.00, date '2026-07-12', '暂不可登记', '大额差异待财务经理签核,暂不可登记付款',
   '待财务经理签核', null, null, 'user-buyer-li', now(), now())
on conflict (tenant_id, payment_request_id) do update set
  payment_batch_no = excluded.payment_batch_no,
  invoice_id = excluded.invoice_id,
  supplier_id = excluded.supplier_id,
  registered_amount = excluded.registered_amount,
  planned_payment_date = excluded.planned_payment_date,
  execution_status = excluded.execution_status,
  execution_trace = excluded.execution_trace,
  execution_block_reason = excluded.execution_block_reason,
  release_evidence_no = excluded.release_evidence_no,
  release_remark = excluded.release_remark,
  updated_at = now();

insert into payment_block_resolutions
  (id, tenant_id, payment_batch_no, payment_request_id, invoice_id, supplier_id,
   block_reason, resolution_status, resolution_action, next_step, handled_by, created_by)
values
  ('blockres-var', 'tenant-acme', 'PB-2026-0002', 'preq-var', 'inv-var', 'ent-supplier-sunrise',
   '差异未处理', '待处理', '补充差异处理结论', '采购确认差异归因后重新刷新付款执行', null, 'user-buyer-li'),
  ('blockres-bigvar', 'tenant-acme', 'PB-2026-0002', 'preq-bigvar', 'inv-bigvar', 'ent-supplier-sunrise',
   '待财务经理签核', '处理中', '等待财务经理签核', '签核通过后解除付款登记阻断', 'user-buyer-li', 'user-buyer-li')
on conflict (tenant_id, payment_batch_no, payment_request_id, block_reason) do update set
  resolution_status = excluded.resolution_status,
  resolution_action = excluded.resolution_action,
  next_step = excluded.next_step,
  handled_by = excluded.handled_by,
  updated_at = now();

insert into payment_archive_exception_requests
  (id, tenant_id, payment_batch_no, exception_type, exception_reason, approval_status,
   requested_by, reviewed_by, action_status, action_result, handled_by, closure_status, closure_result, closed_by)
values
  ('archive-ex-pb2', 'tenant-acme', 'PB-2026-0002', '差异阻断归档', '批次存在未完成差异处理,需审批后暂存归档。',
   '待审批', 'user-buyer-li', null, '待处理', null, null, '待关闭', null, null)
on conflict (tenant_id, payment_batch_no, exception_type, approval_status) do update set
  exception_reason = excluded.exception_reason,
  requested_by = excluded.requested_by,
  action_status = excluded.action_status,
  action_result = excluded.action_result,
  handled_by = excluded.handled_by,
  closure_status = excluded.closure_status,
  closure_result = excluded.closure_result,
  closed_by = excluded.closed_by,
  updated_at = now();

-- 4) 附件、通知与审计历史,让详情页和审计页有可读轨迹。
insert into attachments
  (id, tenant_id, owner_type, owner_id, file_name, storage_key, uploaded_by, visibility, status, created_at)
values
  ('att-contract-demo-main', 'tenant-acme', 'contract', 'ctr-demo', '线缆采购框架合同-盖章版.pdf',
   'demo/contracts/HT-2026-0001-signed.pdf', 'user-buyer-owner', 'buyer_internal', 'active',
   timestamptz '2026-06-20 15:00:00+08'),
  ('att-contract-printer-main', 'tenant-acme', 'contract', 'ctr-printer', '打印机采购维护合同.pdf',
   'demo/contracts/HT-2026-0002.pdf', 'user-buyer-owner', 'buyer_internal', 'active',
   timestamptz '2026-06-24 16:00:00+08'),
  ('att-supplier-sunrise-license', 'tenant-acme', 'supplier', 'ent-supplier-sunrise', '晨光科技营业执照.pdf',
   'demo/suppliers/sunrise-license.pdf', 'user-buyer-zhang', 'buyer_internal', 'active',
   timestamptz '2026-06-18 11:00:00+08')
on conflict (id) do update set
  file_name = excluded.file_name,
  storage_key = excluded.storage_key,
  visibility = excluded.visibility,
  status = excluded.status;

insert into notifications (id, tenant_id, recipient_id, title, content, read_at, created_at)
values
  ('notif-payment-block', 'tenant-acme', 'user-buyer-li', '付款批次存在阻断',
   'PB-2026-0002 存在2笔暂不可登记付款,请完成差异处理与财务经理签核。', null,
   timestamptz '2026-07-04 16:20:00+08'),
  ('notif-contract-expire', 'tenant-acme', 'user-buyer-owner', '合同即将到期',
   '打印机采购及维护合同将于2026-08-15到期,建议提前发起续签。', null,
   timestamptz '2026-07-05 09:00:00+08'),
  ('notif-demand-approved', 'tenant-acme', 'user-buyer-zhang', '采购需求已通过',
   '机房服务器采购需求已审批通过,可进入询价环节。', timestamptz '2026-07-03 14:00:00+08',
   timestamptz '2026-07-03 13:40:00+08')
on conflict (id) do update set
  title = excluded.title,
  content = excluded.content,
  read_at = excluded.read_at,
  created_at = excluded.created_at;

insert into notification_deliveries
  (id, tenant_id, channel, target, title, content, status, detail, dispatched_at)
values
  ('delivery-payment-block-email', 'tenant-acme', 'email', 'finance@acme.example.com',
   '付款批次存在阻断', 'PB-2026-0002 存在暂不可登记付款。', '已发送', 'SMTP accepted', timestamptz '2026-07-04 16:21:00+08'),
  ('delivery-contract-expire-email', 'tenant-acme', 'email', 'procurement@acme.example.com',
   '合同即将到期', 'HT-2026-0002 将于2026-08-15到期。', '已发送', 'SMTP accepted', timestamptz '2026-07-05 09:01:00+08')
on conflict (id) do update set
  status = excluded.status,
  detail = excluded.detail,
  dispatched_at = excluded.dispatched_at;

insert into audit_logs (id, tenant_id, actor_id, action, target_type, target_id, created_at, detail)
values
  ('audit-mat-server-created', 'tenant-acme', 'user-buyer-owner', 'material.created', 'material', 'mat-server',
   timestamptz '2026-06-28 09:00:00+08', '补充服务器物料主数据'),
  ('audit-mat-printer-created', 'tenant-acme', 'user-buyer-owner', 'material.created', 'material', 'mat-printer',
   timestamptz '2026-06-28 09:10:00+08', '补充打印机物料主数据'),
  ('audit-demand-server-approved', 'tenant-acme', 'user-buyer-owner', 'purchase_demand.approved', 'purchase_demand', 'dem-demo-server',
   timestamptz '2026-06-29 15:30:00+08', '预算校验通过'),
  ('audit-demand-monitor-submitted', 'tenant-acme', 'user-buyer-zhang', 'purchase_demand.submitted', 'purchase_demand', 'dem-demo-monitor',
   timestamptz '2026-07-03 10:05:00+08', '提交部门主管审批'),
  ('audit-rfq-demo-updated', 'tenant-acme', 'user-buyer-owner', 'rfq.updated', 'rfq', 'rfq-demo',
   timestamptz '2026-06-18 15:30:00+08', '发布澄清答复'),
  ('audit-contract-demo-archived-pending', 'tenant-acme', 'user-buyer-owner', 'contract.updated', 'contract', 'ctr-demo',
   timestamptz '2026-06-25 09:30:00+08', '登记补充协议'),
  ('audit-contract-printer-created', 'tenant-acme', 'user-buyer-owner', 'contract.created', 'contract', 'ctr-printer',
   timestamptz '2026-06-24 16:00:00+08', '由采购订单生成合同'),
  ('audit-invoice-var-reconciled', 'tenant-acme', 'user-buyer-li', 'invoice.updated', 'invoice', 'inv-var',
   timestamptz '2026-06-24 10:30:00+08', '登记金额差异处理'),
  ('audit-payment-batch-blocked', 'tenant-acme', 'user-buyer-li', 'payment_batch.updated', 'payment_batch', 'PB-2026-0002',
   timestamptz '2026-07-04 16:20:00+08', '生成付款阻断处理任务')
on conflict (id) do update set
  action = excluded.action,
  target_type = excluded.target_type,
  target_id = excluded.target_id,
  created_at = excluded.created_at,
  detail = excluded.detail;
