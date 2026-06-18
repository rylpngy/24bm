import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer approval detail UI', () => {
  it('connects approval queue selections to an approval detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');

    expect(buyerAdminUi).toContain('buildApprovalDetailPanel');
    expect(buyerAdminUi).toContain('businessFacts');
    expect(buyerAdminUi).toContain('contextRows');
    expect(buyerAdminUi).toContain('timelineRows');

    expect(app).toContain('buildApprovalDetailPanel');
    expect(app).toContain('selectedApprovalId');
    expect(app).toContain('setSelectedApprovalId');
    expect(app).toContain('ApprovalDetailPanelView');
    expect(app).toContain('审批详情');
    expect(app).toContain('业务上下文');
    expect(app).toContain('处理轨迹');
    expect(app).toContain('当前详情');
  });
});
