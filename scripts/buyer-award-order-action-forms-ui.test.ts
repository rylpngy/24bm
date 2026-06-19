import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer award and order action forms UI', () => {
  it('collects award reason and expected receipt date before Java actions', () => {
    const app = read('App.tsx');
    const buyerWorkspace = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const AuditLogList'),
    );

    expect(app).toContain('type BuyerAwardDraft');
    expect(app).toContain('type BuyerOrderDraft');
    expect(app).toContain('submitBuyerAwardApproval = async (rfqId: string, quoteId: string, draft: BuyerAwardDraft)');
    expect(app).toContain('createBuyerOrderFromAward = async (awardId: string, draft: BuyerOrderDraft)');
    expect(app).toContain('reason: draft.reason');
    expect(app).toContain('expectedReceiptDate: draft.expectedReceiptDate');
    expect(buyerWorkspace).toContain('awardDrafts');
    expect(buyerWorkspace).toContain('orderDrafts');
    expect(app).toContain('定标理由');
    expect(app).toContain('预计到货日期');
    expect(app).toContain('onSubmitAwardApproval(rfq.id, recommendedQuote.id, awardDraft)');
    expect(app).toContain('onCreateOrderFromAward(approvedAwardId, orderDraft)');
  });
});
