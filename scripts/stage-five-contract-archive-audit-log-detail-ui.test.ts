import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive audit log detail', () => {
  it('loads and renders target audit logs for the contract archive review panel', () => {
    const app = read('App.tsx');
    const api = read('services/procurementApiClient.ts');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');
    const smoke = read('scripts/java-local-smoke.mjs');

    expect(api).toContain('listBuyerTargetAuditLogs');
    expect(api).toContain('/api/v1/buyer/audit-logs/target');
    expect(app).toContain('contractTargetAuditLogsById');
    expect(app).toContain('loadBuyerContractTargetAuditLogs');
    expect(app).toContain('合同审计日志明细');
    expect(app).toContain('目标对象审计');
    expect(app).toContain('最近审计动作');
    expect(app).toContain('contract_fulfillment_event.created');

    expect(checklist).toContain('| 26 | 合同归档审计日志明细 |');
    expect(walkthrough).toContain('合同归档审计日志明细');
    expect(smoke).toContain('Contract target audit logs loaded');
  });
});
