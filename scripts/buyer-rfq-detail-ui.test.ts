import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer RFQ detail UI', () => {
  it('connects RFQ list and quote comparison views to an RFQ detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');

    expect(buyerAdminUi).toContain('buildRfqDetailPanel');
    expect(buyerAdminUi).toContain('quoteRows');
    expect(buyerAdminUi).toContain('recommendedSupplierLabel');
    expect(buyerAdminUi).toContain('orderLabel');
    expect(buyerAdminUi).toContain('fulfillmentTimelineRows');
    expect(buyerAdminUi).toContain('relatedRows');

    expect(app).toContain('buildRfqDetailPanel');
    expect(app).toContain('selectedRfqId');
    expect(app).toContain('setSelectedRfqId');
    expect(app).toContain('RfqDetailPanelView');
    expect(app).toContain('询价详情');
    expect(app).toContain('邀请供应商');
    expect(app).toContain('报价排行');
    expect(app).toContain('履约轨迹');
    expect(app).toContain('关联业务');
    expect(app).toContain('发票付款');
    expect(app).toContain('查看详情');
  });
});
