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
    expect(buyerAdminUi).toContain('flowCheckRows');
    expect(buyerAdminUi).toContain('workflowTimelineRows');
    expect(buyerAdminUi).toContain('relatedRows');

    expect(app).toContain('buildDemandDetailPanel');
    expect(app).toContain('selectedDemandId');
    expect(app).toContain('setSelectedDemandId');
    expect(app).toContain('DemandDetailPanelView');
    expect(app).toContain('需求详情');
    expect(app).toContain('物料明细');
    expect(app).toContain('关联询价');
    expect(app).toContain('流程检查');
    expect(app).toContain('流程轨迹');
    expect(app).toContain('关联业务');
    expect(app).toContain('采购订单');
    expect(app).toContain('查看详情');
  });

  it('surfaces status-aware demand actions inside the detail panel', () => {
    const app = read('App.tsx');

    expect(app).toContain('DemandDetailOperationPanel');
    expect(app).toContain('需求操作');
    expect(app).toContain('demand?: BuyerWorkspace[\'demands\'][number]');
    expect(app).toContain('onSubmitDemand: (demandId: string) => void');
    expect(app).toContain('onCreateRfqFromDemand: (demandId: string, supplierIds: string[], deadline: string) => void');
    expect(app).toContain('detail={selectedDemandDetail}');
    expect(app).toContain('demand={selectedDemandRecord}');
    expect(app).toContain('linkedDemandIds={linkedDemandIds}');
    expect(app).toContain('demandSubmitBusyId={demandSubmitBusyId}');
    expect(app).toContain('rfqCreateBusy={rfqCreateBusy}');
  });
});
