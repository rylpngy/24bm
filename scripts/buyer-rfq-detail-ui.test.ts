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

  it('surfaces RFQ award and order actions inside the detail panel', () => {
    const app = read('App.tsx');
    const rfqDetailView = app.slice(
      app.indexOf('const RfqDetailPanelView'),
      app.indexOf('const QuoteComparisonDetailPanelView'),
    );

    expect(rfqDetailView).toContain('RfqDetailOperationPanel');
    expect(rfqDetailView).toContain('询价操作');
    expect(rfqDetailView).toContain('rfq?: Rfq');
    expect(rfqDetailView).toContain('approvedAwardId?: string');
    expect(rfqDetailView).toContain('awardSubmitBusyId: string | null');
    expect(rfqDetailView).toContain('orderCreateBusy: string | null');
    expect(rfqDetailView).toContain('awardDraft?: BuyerAwardDraft');
    expect(rfqDetailView).toContain('orderDraft?: BuyerOrderDraft');
    expect(rfqDetailView).toContain('onSubmitAwardApproval: (rfqId: string, quoteId: string, draft: BuyerAwardDraft) => void');
    expect(rfqDetailView).toContain('onCreateOrderFromAward: (awardId: string, draft: BuyerOrderDraft) => void');
    expect(app).toContain('rfq={selectedRfqRecord}');
    expect(app).toContain('approvedAwardId={selectedRfqApprovedAwardId}');
  });

  it('places recommendation, order, and next action summary in the top RFQ detail card', () => {
    const app = read('App.tsx');
    const rfqDetail = app.slice(
      app.indexOf('const RfqDetailPanelView'),
      app.indexOf('const RfqDetailOperationPanel'),
    );
    const topCard = rfqDetail.slice(
      rfqDetail.indexOf('<DetailHeroCard'),
      rfqDetail.indexOf('<section>'),
    );

    expect(topCard).toContain('summaryFacts={[');
    expect(topCard).toContain("{ label: '推荐结果', value: detail.recommendedSupplierLabel }");
    expect(topCard).toContain("{ label: '订单状态', value: detail.orderLabel }");
    expect(topCard).toContain("{ label: '下一步', value: detail.nextActionTitle }");
    expect(topCard.indexOf("{ label: '推荐结果', value: detail.recommendedSupplierLabel }")).toBeGreaterThan(
      topCard.indexOf('facts={detail.facts}'),
    );
  });
});
