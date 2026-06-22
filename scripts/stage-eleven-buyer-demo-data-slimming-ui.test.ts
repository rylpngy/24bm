import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage eleven buyer demo data slimming UI', () => {
  it('adds a buyer main-flow demo data limiter that preserves recommended samples', () => {
    const app = read('App.tsx');

    expect(app).toContain('const BUYER_MAIN_FLOW_DEMO_LIST_LIMIT = 6');
    expect(app).toContain('limitBuyerDemoRows');
    expect(app).toContain('保留推荐样本');
    expect(app).toContain('压缩列表样本');
    expect(app).toContain('隐藏非主线说明');
  });

  it('uses the buyer demo limiter for all seven buyer main-flow lists', () => {
    const app = read('App.tsx');

    [
      'const displayedDemandListRows = limitBuyerDemoRows(',
      'const displayedApprovalQueueRows = limitBuyerDemoRows(',
      'const displayedRfqListRows = limitBuyerDemoRows(',
      'const displayedQuoteRfqs = limitBuyerDemoRows(',
      'const displayedOrderFulfillmentRows = limitBuyerDemoRows(',
      'const displayedReceiptInspectionRows = limitBuyerDemoRows(',
      'const displayedInvoicePaymentRows = limitBuyerDemoRows(',
    ].forEach((copy) => {
      expect(app).toContain(copy);
    });
  });

  it('renders a compact demo data slimming cue in the buyer walkthrough area', () => {
    const app = read('App.tsx');

    expect(app).toContain('data-testid="stage11-buyer-demo-data-slimming"');
    expect(app).toContain('演示数据瘦身');
    expect(app).toContain('保留当前页推荐演示样本');
    expect(app).toContain('主流程列表最多展示 6 条');
  });

  it('records the seventh stage-eleven increment as buyer demo data slimming', () => {
    const checklist = read('docs/stage-eleven-execution-checklist.md');

    expect(checklist).toContain('| 7 | 采购方主流程演示数据瘦身 |');
    expect(checklist).toContain('减少首屏非主线说明、压缩列表样本数量和保留推荐样本');
    expect(checklist).toContain('scripts/stage-eleven-buyer-demo-data-slimming-ui.test.ts');
  });
});
