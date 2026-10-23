import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { buildAuditSql } from './data-audit-checks.mjs';

const required = (key) => { assert.ok(process.env[key], `Missing ${key}`); return process.env[key]; };
const container = required('AUDIT_DB_CONTAINER');
const database = required('AUDIT_DB_NAME');
const user = required('AUDIT_DB_USER');
const output = required('AUDIT_REPORT_PREFIX');
// No shell interpolation, credentials in reports, or implicit choice of the shared database.
const raw = execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t',
  '-v', 'ON_ERROR_STOP=1', `--username=${user}`, `--dbname=${database}`], {
  input: buildAuditSql(), encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024,
});
const report = JSON.parse(raw);
assert.equal(report.database, database);
assert.equal(report.readOnly, 'on');
assert.equal(report.isolation, 'repeatable read');
report.container = container;
report.scope = 'Selected database only; findings are not proof of production defects. Samples capped at 20 per check; counts are complete.';
writeFileSync(`${output}.json`, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
const rows = report.checks.map(c => `| ${c.id} | ${c.severity} | ${c.title} | ${c.count} | ${c.action} |`);
writeFileSync(`${output}.md`, [
  '# 存量账号与业务数据只读核查', '',
  `数据库：${database}；容器：${container}；时间：${report.generatedAt}。`,
  '只读、可重复读快照；未变更账号、权限、审批、付款或数据库结构。',
  '仅代表指定数据库，不代表生产数据。每项计数完整，JSON定位样本最多20条；同一记录可命中多项，不可将命中数相加当作异常记录总数。',
  '未检查附件对象存储实物、所有多层部门循环、外部支付真实性或全部流程路由。异常需先核对原始业务凭据。', '',
  `数据量：租户${report.inventory.tenants}，账号${report.inventory.users}，订单${report.inventory.orders}，发票${report.inventory.invoices}。`, '',
  '| 检查编号 | 判定 | 检查项 | 命中数 | 处理建议 |', '| --- | --- | --- | ---: | --- |', ...rows, '',
].join('\n'), { mode: 0o600 });
console.log(JSON.stringify({ database, inventory: report.inventory,
  findings: report.checks.filter(c => c.count).map(({ id, severity, count }) => ({ id, severity, count })),
  outputs: [`${output}.json`, `${output}.md`] }, null, 2));
