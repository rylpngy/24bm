import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer audit summary panel UI details', () => {
  it('summarizes audit action and target evidence in the traceability panel', () => {
    const app = read('App.tsx');
    const auditSummaryPanel = app.slice(
      app.indexOf('const AuditTraceabilitySummaryPanel'),
      app.indexOf('const RfqDetailPanelView'),
    );

    expect(auditSummaryPanel).toContain('操作摘要');
    expect(auditSummaryPanel).toContain('动作编码');
    expect(auditSummaryPanel).toContain('对象类型');
    expect(auditSummaryPanel).toContain('对象编号');
    expect(auditSummaryPanel).toContain('留痕结果');
    expect(auditSummaryPanel).toContain('关联业务');
    expect(auditSummaryPanel).toContain('detail.actionCode');
    expect(auditSummaryPanel).toContain('detail.facts.find');
    expect(auditSummaryPanel).toContain('detail.traceabilityRows.find');
  });
});
