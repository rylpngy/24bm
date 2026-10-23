// Keep these predicates aligned with PermissionMapper and PaymentReviewApplicationService.
export const commonCtes = `
effective_roles AS (
  SELECT u.id AS user_id, u.tenant_id, u.supplier_id, r.id AS role_id, r.scope, r.permissions, r.data_scope
  FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
  WHERE r.tenant_id IS NOT DISTINCT FROM u.tenant_id
    AND r.scope=CASE WHEN u.tenant_id IS NOT NULL THEN 'buyer'
      WHEN u.supplier_id IS NOT NULL THEN 'supplier' ELSE 'platform' END
), paid AS (
  SELECT i.id, i.tenant_id, i.amount, i.payment_status, i.order_id, i.supplier_id,
    COALESCE(sum(e.amount),0) AS ledger_amount, count(e.id) AS entry_count
  FROM invoices i LEFT JOIN invoice_payment_entries e ON e.invoice_id=i.id AND e.tenant_id=i.tenant_id
  GROUP BY i.id, i.tenant_id, i.amount, i.payment_status, i.order_id, i.supplier_id
)`;

export const checks = [
  {
    id: 'account_no_effective_role', category: '账号与权限', severity: '异常', title: '启用账号无有效角色',
    action: '确认账号归属及岗位后由管理员授权；无使用需求则经确认停用，不能自动授予管理员权限。',
    sql: `SELECT u.id, u.tenant_id, u.supplier_id FROM users u WHERE u.status='active'
      AND NOT EXISTS (SELECT 1 FROM effective_roles er WHERE er.user_id=u.id)`,
  },
  {
    id: 'role_binding_scope', category: '账号与权限', severity: '异常', title: '角色绑定与账号租户或端类型不一致',
    action: '当前权限过滤不采用此类绑定；确认正确岗位后修正绑定，不能通过放宽租户过滤解决。',
    sql: `SELECT ur.user_id AS id, ur.role_id, u.tenant_id, u.supplier_id FROM user_roles ur
      JOIN users u ON u.id=ur.user_id WHERE NOT EXISTS
      (SELECT 1 FROM effective_roles er WHERE er.user_id=ur.user_id AND er.role_id=ur.role_id)`,
  },
  {
    id: 'account_department', category: '账号与权限', severity: '异常', title: '账号部门不存在或跨租户',
    action: '按实际组织关系核对账号部门，不自动迁移账号所属企业。',
    sql: `SELECT u.id, u.tenant_id, u.department_id FROM users u LEFT JOIN departments d ON d.id=u.department_id
      WHERE u.department_id IS NOT NULL AND (d.id IS NULL OR d.tenant_id IS DISTINCT FROM u.tenant_id)`,
  },
  {
    id: 'department_parent', category: '账号与权限', severity: '异常', title: '部门上级不存在、跨租户或指向自身',
    action: '核对组织层级后修正；本项不替代所有多层循环检查。',
    sql: `SELECT d.id, d.tenant_id, d.parent_id FROM departments d LEFT JOIN departments p ON p.id=d.parent_id
      WHERE d.parent_id IS NOT NULL AND (p.id IS NULL OR p.tenant_id IS DISTINCT FROM d.tenant_id OR p.id=d.id)`,
  },
  {
    id: 'department_manager', category: '账号与权限', severity: '待确认', title: '部门主管缺失、停用或不属于本部门',
    action: '确认是否允许跨部门兼任主管，再维护主管及其有效岗位。',
    sql: `SELECT d.id, d.tenant_id, d.manager_id FROM departments d LEFT JOIN users u ON u.id=d.manager_id
      WHERE d.status='active' AND (u.id IS NULL OR u.status<>'active'
      OR u.tenant_id IS DISTINCT FROM d.tenant_id OR u.department_id IS DISTINCT FROM d.id)`,
  },
  {
    id: 'restricted_role_without_department', category: '账号与权限', severity: '待确认', title: '部门范围账号未配置有效部门',
    action: '按岗位补齐部门；已有全部数据角色时本项不报缺失，不能用扩大数据权限代替组织维护。',
    sql: `SELECT u.id, u.tenant_id FROM users u LEFT JOIN departments d ON d.id=u.department_id AND d.tenant_id=u.tenant_id
      WHERE u.status='active' AND (d.id IS NULL OR d.status<>'active')
      AND EXISTS (SELECT 1 FROM effective_roles er WHERE er.user_id=u.id AND er.scope='buyer' AND er.data_scope IN ('department','department_and_below'))
      AND NOT EXISTS (SELECT 1 FROM effective_roles er WHERE er.user_id=u.id AND er.data_scope='all')`,
  },
  {
    id: 'supplier_no_owner', category: '账号与权限', severity: '待确认', title: '供应商已有账号但无启用管理员',
    action: '确认该企业是否仍需登录及团队维护；管理员身份需企业确认，不自动将业务成员升级。',
    sql: `SELECT DISTINCT u.supplier_id AS id FROM users u WHERE u.supplier_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users owner JOIN effective_roles er ON er.user_id=owner.id
        WHERE owner.supplier_id=u.supplier_id AND owner.status='active' AND er.permissions ? 'supplier:*')`,
  },
  {
    id: 'broad_permissions', category: '账号与权限', severity: '待确认', title: '启用账号的端级管理员角色绑定',
    action: '逐项确认确为管理员；这是权限清单，不代表已发生越权，历史角色不自动替换。',
    sql: `SELECT DISTINCT u.id, u.tenant_id, u.supplier_id, er.role_id FROM users u JOIN effective_roles er ON er.user_id=u.id
      WHERE u.status='active' AND er.permissions ? (er.scope || ':*')`,
  },
  {
    id: 'invoice_order_scope', category: '业务关联', severity: '异常', title: '发票与订单租户或供应商不一致',
    action: '暂停该记录后续财务操作，由业务人员确认真实订单及归属后制定修复方案。',
    sql: `SELECT i.id, i.tenant_id, i.order_id FROM invoices i LEFT JOIN purchase_orders o ON o.id=i.order_id
      WHERE o.id IS NULL OR i.tenant_id IS DISTINCT FROM o.tenant_id OR i.supplier_id IS DISTINCT FROM o.supplier_id`,
  },
  {
    id: 'fulfillment_scope', category: '业务关联', severity: '异常', title: '发货或收货记录与订单归属不一致',
    action: '核对原始履约凭据，不能仅改状态掩盖关联问题。',
    sql: `SELECT d.id, d.tenant_id, d.order_id, 'delivery' AS record_type FROM deliveries d LEFT JOIN purchase_orders o ON o.id=d.order_id
      WHERE o.id IS NULL OR d.tenant_id IS DISTINCT FROM o.tenant_id OR d.supplier_id IS DISTINCT FROM o.supplier_id
      UNION ALL SELECT r.id, r.tenant_id, r.order_id, 'receipt' FROM receipts r LEFT JOIN purchase_orders o ON o.id=r.order_id
      WHERE o.id IS NULL OR r.tenant_id IS DISTINCT FROM o.tenant_id`,
  },
  {
    id: 'order_fulfillment_missing', category: '业务关联', severity: '待确认', title: '已发货或已收货订单缺少对应履约记录',
    action: '区分历史导入和数据丢失，核对原始单据后补录，不能凭订单状态虚构物流和验收信息。',
    sql: `SELECT o.id, o.tenant_id, o.status FROM purchase_orders o WHERE
      (o.status IN ('已发货','已收货') AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.order_id=o.id AND d.tenant_id=o.tenant_id))
      OR (o.status='已收货' AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id=o.id AND r.tenant_id=o.tenant_id))`,
  },
  {
    id: 'payment_entry_scope', category: '财务核对', severity: '异常', title: '付款流水归属或冲销关系不一致',
    action: '财务核对真实付款及冲销凭据，保留原始流水，不直接删除记录或改写余额。',
    sql: `SELECT e.id, e.tenant_id, e.invoice_id FROM invoice_payment_entries e LEFT JOIN invoices i ON i.id=e.invoice_id
      LEFT JOIN invoice_payment_entries original ON original.id=e.reversal_of
      WHERE i.id IS NULL OR e.tenant_id IS DISTINCT FROM i.tenant_id
      OR (e.reversal_of IS NOT NULL AND (original.id IS NULL OR original.tenant_id IS DISTINCT FROM e.tenant_id
        OR original.invoice_id IS DISTINCT FROM e.invoice_id OR original.amount<=0 OR original.amount<>-e.amount))`,
  },
  {
    id: 'payment_balance', category: '财务核对', severity: '待确认', title: '付款状态与金额流水不一致',
    action: '使用付款核对记录收集凭据；无流水的历史已付款不等于实际未付款，不自动补记余额。',
    sql: `SELECT id, tenant_id, payment_status, amount, ledger_amount, entry_count FROM paid
      WHERE ledger_amount<0 OR ledger_amount>amount
        OR (payment_status='已付款' AND ledger_amount<>amount)
        OR (payment_status='部分付款' AND NOT (ledger_amount>0 AND ledger_amount<amount))
        OR (payment_status='待付款' AND ledger_amount<>0)`,
  },
  {
    id: 'payment_request_evidence', category: '财务核对', severity: '待确认', title: '已有付款但缺少匹配的已通过付款申请',
    action: '核对历史审批依据和原始付款单，不自动补通过审批。',
    sql: `SELECT p.id, p.tenant_id, p.payment_status FROM paid p
      WHERE (p.entry_count>0 OR p.payment_status IN ('已付款','部分付款')) AND NOT EXISTS
      (SELECT 1 FROM payment_requests r WHERE r.tenant_id=p.tenant_id AND r.invoice_id=p.id
        AND r.request_status='付款申请已通过' AND r.order_id=p.order_id AND r.supplier_id=p.supplier_id AND r.amount=p.amount)`,
  },
  {
    id: 'payment_batch_evidence', category: '财务核对', severity: '待确认', title: '已有付款但缺少已通过付款批次',
    action: '与付款申请及批次审批凭据一起核对，不以补批次状态替代审批。',
    sql: `SELECT p.id, p.tenant_id FROM paid p WHERE (p.entry_count>0 OR p.payment_status IN ('已付款','部分付款'))
      AND NOT EXISTS (SELECT 1 FROM payment_requests r JOIN payment_batches b
        ON b.tenant_id=r.tenant_id AND b.payment_batch_no=r.payment_batch_no
        WHERE r.tenant_id=p.tenant_id AND r.invoice_id=p.id AND r.request_status='付款申请已通过'
          AND b.batch_status IN ('可安排付款','已付款归档'))`,
  },
  {
    id: 'legacy_runtime_active', category: '流程运行时', severity: '待确认', title: '旧自研运行时仍有非终态实例',
    action: '核对实例来源及业务状态，逐项决定迁移或结束方式，不直接修改Flowable或旧实例状态。',
    sql: `SELECT id, tenant_id, status FROM process_instances WHERE status NOT IN ('approved','rejected','cancelled')`,
  },
];

const literal = (value) => `'${value.replaceAll("'", "''")}'`;
export function buildAuditSql() {
  const ctes = checks.map((check, i) => `finding_${i} AS (${check.sql})`);
  const results = checks.map((check, i) => `SELECT ${i} AS ordinal, jsonb_build_object(
    'id',${literal(check.id)},'category',${literal(check.category)},'severity',${literal(check.severity)},
    'title',${literal(check.title)},'action',${literal(check.action)},
    'count',(SELECT count(*) FROM finding_${i}),
    'samples',COALESCE((SELECT jsonb_agg(to_jsonb(sample)) FROM (SELECT * FROM finding_${i} ORDER BY id LIMIT 20) sample),'[]'::jsonb)) AS result`);
  return `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='3s';
WITH ${commonCtes}, ${ctes.join(',\n')}
SELECT jsonb_build_object('database',current_database(),'readOnly',current_setting('transaction_read_only'),
  'generatedAt',transaction_timestamp(),'isolation',current_setting('transaction_isolation'),
  'inventory',jsonb_build_object('tenants',(SELECT count(*) FROM tenants),'users',(SELECT count(*) FROM users),
    'orders',(SELECT count(*) FROM purchase_orders),'invoices',(SELECT count(*) FROM invoices)),
  'checks',(SELECT jsonb_agg(result ORDER BY ordinal) FROM (${results.join('\nUNION ALL\n')}) results));
ROLLBACK;`;
}
