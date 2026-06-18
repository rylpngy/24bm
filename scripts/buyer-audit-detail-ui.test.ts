import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer audit detail UI', () => {
  it('connects audit log selections to an audit detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');
    const auditDetailView = app.slice(
      app.indexOf('const AuditLogDetailPanelView'),
      app.indexOf('const RfqDetailPanelView'),
    );

    expect(buyerAdminUi).toContain('buildAuditLogDetailPanel');
    expect(buyerAdminUi).toContain('targetFacts');
    expect(buyerAdminUi).toContain('relatedRows');
    expect(buyerAdminUi).toContain('traceabilityRows');
    expect(buyerAdminUi).toContain('timelineRows');

    expect(app).toContain('buildAuditLogDetailPanel');
    expect(app).toContain('selectedAuditLogId');
    expect(app).toContain('setSelectedAuditLogId');
    expect(app).toContain('AuditLogDetailPanelView');
    expect(auditDetailView).toContain('日志详情');
    expect(auditDetailView).toContain('对象上下文');
    expect(auditDetailView).toContain('追溯检查');
    expect(auditDetailView).toContain('traceabilityRows');
    expect(auditDetailView).toContain('关联业务');
    expect(auditDetailView).toContain('处理轨迹');
  });
});
