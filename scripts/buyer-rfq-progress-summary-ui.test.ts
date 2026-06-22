import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = () => readFileSync('App.tsx', 'utf8');
const checklist = () => readFileSync('docs/stage-three-round-two-execution-checklist.md', 'utf8');

describe('buyer RFQ progress summary UI', () => {
  it('surfaces list-level RFQ progress summary for sourcing follow-up', () => {
    const source = app();
    const buyerWorkspace = source.slice(
      source.indexOf('const BuyerWorkspaceView'),
      source.indexOf('const DemandDetailPanelView'),
    );
    const rfqModule = source.slice(
      source.indexOf('<Panel title="询价项目"'),
      source.indexOf('<RfqDetailPanelView'),
    );

    expect(buyerWorkspace).toContain('rfqPendingInvitationCount');
    expect(buyerWorkspace).toContain('rfqInsufficientQuoteCount');
    expect(buyerWorkspace).toContain('rfqReadyForComparisonCount');
    expect(buyerWorkspace).toContain('rfqAwardedCount');
    expect(rfqModule).toContain('询价推进摘要');
    expect(rfqModule).toContain('待补邀请');
    expect(rfqModule).toContain('报价不足');
    expect(rfqModule).toContain('可进入比价定标');
    expect(rfqModule).toContain('已完成定标');
    expect(rfqModule).toContain('优先跟进报价不足项目，再推进可比价项目定标审批。');
  });

  it('records the sixty second stage-three buyer flow increment in the checklist', () => {
    const docs = checklist();

    expect(docs).toContain('| 62 | 询价项目推进摘要 |');
    expect(docs).toContain('scripts/buyer-rfq-progress-summary-ui.test.ts');
    expect(docs).toContain('询价推进摘要');
  });
});
