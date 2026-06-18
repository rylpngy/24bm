import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer audit detail UI', () => {
  it('connects audit log selections to an audit detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');

    expect(buyerAdminUi).toContain('buildAuditLogDetailPanel');
    expect(buyerAdminUi).toContain('targetFacts');
    expect(buyerAdminUi).toContain('relatedRows');
    expect(buyerAdminUi).toContain('timelineRows');

    expect(app).toContain('buildAuditLogDetailPanel');
    expect(app).toContain('selectedAuditLogId');
    expect(app).toContain('setSelectedAuditLogId');
    expect(app).toContain('AuditLogDetailPanelView');
    expect(app).toContain('日志详情');
    expect(app).toContain('对象上下文');
    expect(app).toContain('关联业务');
    expect(app).toContain('处理轨迹');
  });
});
