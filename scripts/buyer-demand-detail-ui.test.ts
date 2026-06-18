import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer demand detail UI', () => {
  it('connects buyer demand list selections to a demand detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');

    expect(buyerAdminUi).toContain('buildDemandDetailPanel');
    expect(buyerAdminUi).toContain('lineItems: demand.lineItems.map');
    expect(buyerAdminUi).toContain('linkedRfqs: workspace.rfqs');
    expect(buyerAdminUi).toContain('approvalLabel');

    expect(app).toContain('buildDemandDetailPanel');
    expect(app).toContain('selectedDemandId');
    expect(app).toContain('setSelectedDemandId');
    expect(app).toContain('DemandDetailPanelView');
    expect(app).toContain('需求详情');
    expect(app).toContain('物料明细');
    expect(app).toContain('关联询价');
    expect(app).toContain('查看详情');
  });
});
