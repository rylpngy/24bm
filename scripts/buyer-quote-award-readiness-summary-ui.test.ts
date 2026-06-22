import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = () => readFileSync('App.tsx', 'utf8');
const checklist = () => readFileSync('docs/stage-three-round-two-execution-checklist.md', 'utf8');

describe('buyer quote award readiness summary UI', () => {
  it('surfaces quote comparison award readiness before RFQ cards', () => {
    const source = app();
    const buyerWorkspace = source.slice(
      source.indexOf('const BuyerWorkspaceView'),
      source.indexOf('const DemandDetailPanelView'),
    );
    const quoteModule = source.slice(
      source.indexOf("<Panel title=\"询价比价与定标\""),
      source.indexOf('<QuoteComparisonDetailPanelView'),
    );

    expect(buyerWorkspace).toContain('quoteAwardableQuoteCount');
    expect(buyerWorkspace).toContain('quoteRecommendedRfqCount');
    expect(buyerWorkspace).toContain('quoteAwardApprovalPendingCount');
    expect(buyerWorkspace).toContain('quoteGeneratedOrderCount');
    expect(quoteModule).toContain('定标准备摘要');
    expect(quoteModule).toContain('可定标报价');
    expect(quoteModule).toContain('推荐报价项目');
    expect(quoteModule).toContain('待审批定标');
    expect(quoteModule).toContain('已生成订单');
    expect(quoteModule).toContain('先确认推荐报价，再提交定标审批，审批通过后生成采购订单。');
  });

  it('records the sixty third stage-three buyer flow increment in the checklist', () => {
    const docs = checklist();

    expect(docs).toContain('| 63 | 报价对比定标准备摘要 |');
    expect(docs).toContain('scripts/buyer-quote-award-readiness-summary-ui.test.ts');
    expect(docs).toContain('定标准备摘要');
  });
});
