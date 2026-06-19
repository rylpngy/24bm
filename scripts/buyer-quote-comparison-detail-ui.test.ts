import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer quote comparison detail UI', () => {
  it('connects quote comparison selections to a quote decision detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');

    expect(buyerAdminUi).toContain('buildQuoteComparisonDetailPanel');
    expect(buyerAdminUi).toContain('recommendationFacts');
    expect(buyerAdminUi).toContain('awardTimelineRows');
    expect(buyerAdminUi).toContain('relatedRows');
    expect(buyerAdminUi).toContain('canSubmitAward');

    expect(app).toContain('buildQuoteComparisonDetailPanel');
    expect(app).toContain('QuoteComparisonDetailPanelView');
    expect(app).toContain('比价详情');
    expect(app).toContain('推荐结论');
    expect(app).toContain('定标审批');
    expect(app).toContain('报价排行');
    expect(app).toContain('关联业务');
    expect(app).toContain('发票付款');
  });

  it('surfaces quote decision actions inside the detail panel', () => {
    const app = read('App.tsx');
    const quoteDetailView = app.slice(
      app.indexOf('const QuoteComparisonDetailPanelView'),
      app.indexOf('const OrderDetailPanelView'),
    );

    expect(quoteDetailView).toContain('QuoteComparisonOperationPanel');
    expect(quoteDetailView).toContain('比价操作');
    expect(quoteDetailView).toContain('rfq?: Rfq');
    expect(quoteDetailView).toContain('approvedAwardId?: string');
    expect(quoteDetailView).toContain('awardSubmitBusyId: string | null');
    expect(quoteDetailView).toContain('orderCreateBusy: string | null');
    expect(quoteDetailView).toContain('awardDraft?: BuyerAwardDraft');
    expect(quoteDetailView).toContain('orderDraft?: BuyerOrderDraft');
    expect(quoteDetailView).toContain('onSubmitAwardApproval: (rfqId: string, quoteId: string, draft: BuyerAwardDraft) => void');
    expect(quoteDetailView).toContain('onCreateOrderFromAward: (awardId: string, draft: BuyerOrderDraft) => void');
    expect(app).toContain('rfq={selectedRfqRecord}');
    expect(app).toContain('approvedAwardId={selectedRfqApprovedAwardId}');
  });
});
