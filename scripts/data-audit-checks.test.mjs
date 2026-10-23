import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { checks, commonCtes, buildAuditSql } from './data-audit-checks.mjs';

for (const key of ['AUDIT_DB_CONTAINER', 'AUDIT_DB_NAME', 'AUDIT_DB_USER']) assert.ok(process.env[key], `Missing ${key}`);
function query(sql) {
  return execFileSync('docker', ['exec', '-i', process.env.AUDIT_DB_CONTAINER, 'psql', '-X', '-qAt',
    '-v', 'ON_ERROR_STOP=1', `--username=${process.env.AUDIT_DB_USER}`, `--dbname=${process.env.AUDIT_DB_NAME}`],
  { input: sql, encoding: 'utf8', timeout: 45000, stdio: ['pipe', 'pipe', 'pipe'] });
}
function findings(id, fixture) {
  const check = checks.find(c => c.id === id);
  return JSON.parse(query(`BEGIN READ ONLY; SET LOCAL statement_timeout='5s';
    WITH ${fixture}, ${commonCtes}
    SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM (${check.sql}) f; ROLLBACK;`));
}
const identity = `
users(id,tenant_id,supplier_id,status,department_id) AS (VALUES
  ('good','tenant-a',NULL::text,'active',NULL::text),
  ('wrong','tenant-a',NULL,'active',NULL),
  ('missing','tenant-a',NULL,'active',NULL),
  ('disabled','tenant-a',NULL,'inactive',NULL),
  ('supplier',NULL,'supplier-a','active',NULL)),
roles(id,tenant_id,scope,permissions,data_scope) AS (VALUES
  ('buyer-a','tenant-a','buyer','["buyer:*"]'::jsonb,'all'),
  ('buyer-b','tenant-b','buyer','["buyer:*"]'::jsonb,'all'),
  ('supplier',NULL,'supplier','["supplier:order:read"]'::jsonb,'all')),
user_roles(user_id,role_id) AS (VALUES ('good','buyer-a'),('wrong','buyer-b'),('supplier','supplier'))`;

test('effective roles reject cross-tenant roles, retain supplier roles, and ignore inactive missing roles', () => {
  assert.deepEqual(findings('account_no_effective_role', identity).map(r => r.id).sort(), ['missing', 'wrong']);
  assert.deepEqual(findings('role_binding_scope', identity).map(r => r.id), ['wrong']);
  assert.deepEqual(findings('broad_permissions', identity).map(r => r.id), ['good']);
});

test('department restriction checks account for the union of effective scopes', () => {
  const fixture = `users(id,tenant_id,supplier_id,status,department_id) AS (VALUES
    ('restricted','t',NULL::text,'active',NULL::text),('all','t',NULL,'active',NULL)),
    roles(id,tenant_id,scope,permissions,data_scope) AS (VALUES
      ('dept','t','buyer','[]'::jsonb,'department'),('all','t','buyer','[]'::jsonb,'all')),
    user_roles(user_id,role_id) AS (VALUES ('restricted','dept'),('all','dept'),('all','all'))`;
  assert.deepEqual(findings('restricted_role_without_department', fixture).map(r => r.id), ['restricted']);
});

const finance = `invoices(id,tenant_id,amount,payment_status,order_id,supplier_id) AS (VALUES
  ('paid','t',0.30::numeric,'已付款','o','s'),
  ('legacy','t',10,'已付款','o','s'),
  ('partial','t',10,'部分付款','o','s'),
  ('over','t',10,'已付款','o','s'),
  ('unpaid','t',10,'待付款','o','s')),
invoice_payment_entries(id,tenant_id,invoice_id,amount) AS (VALUES
  ('a','t','paid',0.10::numeric),('b','t','paid',0.20),('c','t','partial',4),('d','t','over',11))`;

test('payment balance uses exact SQL decimals and flags unverified historical payment without inferring unpaid', () => {
  const rows = findings('payment_balance', finance);
  assert.deepEqual(rows.map(r => r.id).sort(), ['legacy', 'over']);
  assert.equal(rows.find(r => r.id === 'legacy').entry_count, 0);
});

test('paid records require matching approved requests and batches', () => {
  const fixture = `${finance},
    payment_requests(tenant_id,invoice_id,request_status,order_id,supplier_id,amount,payment_batch_no) AS (VALUES
      ('t','paid','付款申请已通过','o','s',0.30::numeric,'approved'),
      ('t','partial','付款申请已通过','wrong-order','s',10,'pending')),
    payment_batches(tenant_id,payment_batch_no,batch_status) AS (VALUES ('t','approved','已付款归档'),('t','pending','审批中'))`;
  assert.deepEqual(findings('payment_request_evidence', fixture).map(r => r.id).sort(), ['legacy', 'over', 'partial']);
  assert.deepEqual(findings('payment_batch_evidence', fixture).map(r => r.id).sort(), ['legacy', 'over', 'partial']);
});

test('invoice/order ownership cannot cross tenant or supplier boundaries', () => {
  const fixture = `${finance}, purchase_orders(id,tenant_id,supplier_id) AS (VALUES ('o','other','s'))`;
  assert.equal(findings('invoice_order_scope', fixture).length, 5);
});

test('fulfillment status is not proof that supporting records exist', () => {
  const fixture = `purchase_orders(id,tenant_id,status) AS (VALUES
      ('ok','t','已收货'),('missing','t','已收货'),('pending','t','待发货')),
    deliveries(order_id,tenant_id) AS (VALUES ('ok','t'),('missing','wrong')),
    receipts(order_id,tenant_id) AS (VALUES ('ok','t'))`;
  assert.deepEqual(findings('order_fulfillment_missing', fixture).map(r => r.id), ['missing']);
});

test('all audit queries execute in a read-only repeatable snapshot with bounded samples', () => {
  const result = JSON.parse(query(buildAuditSql()));
  assert.equal(result.readOnly, 'on');
  assert.equal(result.isolation, 'repeatable read');
  assert.equal(result.checks.length, checks.length);
  assert.equal(new Set(checks.map(c => c.id)).size, checks.length);
  for (const check of result.checks) assert.ok(check.samples.length <= 20 && check.count >= check.samples.length);
});

test('database rejects writes inside the audit transaction (zero-row write probe)', () => {
  assert.throws(() => query(`BEGIN READ ONLY; UPDATE tenants SET name=name WHERE false; ROLLBACK;`),
    error => /read-only transaction/.test(String(error.stderr)));
});
