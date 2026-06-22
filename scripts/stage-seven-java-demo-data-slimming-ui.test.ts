import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven java demo data slimming', () => {
  it('caps buyer main-flow list rendering for demo performance without changing total counts', () => {
    const app = read('App.tsx');

    expect(app).toContain('const DEMO_LIST_DISPLAY_LIMIT = 20');
    expect(app).toContain('const limitDemoRows = <T,>(rows: T[]) => rows.slice(0, DEMO_LIST_DISPLAY_LIMIT)');
    expect(app).toContain('displayedDemandListRows');
    expect(app).toContain('displayedRfqListRows');
    expect(app).toContain('displayedQuoteRfqs');
    expect(app).toContain('displayedOrderFulfillmentRows');
    expect(app).toContain('displayedReceiptInspectionRows');
    expect(app).toContain('displayedInvoicePaymentRows');
    expect(app).toContain('演示展示上限');
    expect(app).toContain('当前仅渲染前 20 条');
  });

  it('uses capped rows for rendering the six buyer main-flow list surfaces', () => {
    const app = read('App.tsx');

    expect(app).toContain('{displayedDemandListRows.map((demandRow) =>');
    expect(app).toContain('mobileCards={displayedRfqListRows.map((rfq) =>');
    expect(app).toContain('{displayedRfqListRows.map((rfq) =>');
    expect(app).toContain('{displayedQuoteRfqs.map((rfq) =>');
    expect(app).toContain('{displayedOrderFulfillmentRows.map((orderRow) =>');
    expect(app).toContain('{displayedReceiptInspectionRows');
    expect(app).toContain('{displayedInvoicePaymentRows.map((invoiceRow) =>');
  });

  it('records the eighth stage-seven increment as java demo data slimming', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');
    const walkthrough = read('docs/stage-seven-browser-walkthrough-result.md');

    expect(checklist).toContain('| 8 | Java 模式演示数据瘦身第一轮 |');
    expect(checklist).toContain('scripts/stage-seven-java-demo-data-slimming-ui.test.ts');
    expect(checklist).toContain('供应商侧协同演示补强');

    expect(walkthrough).toContain('Java 模式演示数据瘦身');
    expect(walkthrough).toContain('采购方主流程列表默认仅渲染前 20 条');
  });
});
