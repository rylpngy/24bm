import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer demand detail UI', () => {
  it('connects buyer demand list selections to a demand detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');

    expect(buyerAdminUi).toContain('buildDemandDetailPanel');
    expect(buyerAdminUi).toContain('lineItems: demand.lineItems.map');
    expect(buyerAdminUi).toContain('const linkedRfqs = workspace.rfqs.filter');
    expect(buyerAdminUi).toContain('const linkedOrders = workspace.orders.filter');
    expect(buyerAdminUi).toContain('approvalLabel');
    expect(buyerAdminUi).toContain('workflowTimelineRows');
    expect(buyerAdminUi).toContain('relatedRows');

    expect(app).toContain('buildDemandDetailPanel');
    expect(app).toContain('selectedDemandId');
    expect(app).toContain('setSelectedDemandId');
    expect(app).toContain('DemandDetailPanelView');
    expect(app).toContain('需求详情');
    expect(app).toContain('物料明细');
    expect(app).toContain('关联询价');
    expect(app).toContain('流程轨迹');
    expect(app).toContain('关联业务');
    expect(app).toContain('采购订单');
    expect(app).toContain('查看详情');
  });
});
