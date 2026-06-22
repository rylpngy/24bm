import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven buyer demo presentation polish', () => {
  it('adds a shared buyer demo presenter cue for main-flow pages', () => {
    const app = read('App.tsx');

    expect(app).toContain('const BuyerDemoPresenterCue');
    expect(app).toContain('首屏业务焦点');
    expect(app).toContain('详情首屏与列表卡片高度');
    expect(app).toContain('当前选中');
    expect(app).toContain('下一步动作');
    expect(app).toContain('列表卡片高度');
    expect(app).toContain('下一页衔接');
    expect(app).toContain('<BuyerDemoPresenterCue');
    expect(app).toContain('selectedTitle={demoPresenterCue.selectedTitle}');
    expect(app).toContain('displayedCount={demoPresenterCue.displayedCount}');
  });

  it('derives presenter cue data from the active buyer module and displayed rows', () => {
    const app = read('App.tsx');

    expect(app).toContain('const demoPresenterCue = {');
    expect(app).toContain("demands: {");
    expect(app).toContain('selectedDemandDetail?.title');
    expect(app).toContain('displayedDemandListRows.length');
    expect(app).toContain("approvals: {");
    expect(app).toContain('selectedApprovalDetail?.title');
    expect(app).toContain('filteredApprovalQueueRows.length');
    expect(app).toContain("rfqs: {");
    expect(app).toContain('selectedRfqDetail?.title');
    expect(app).toContain('displayedRfqListRows.length');
    expect(app).toContain("quotes: {");
    expect(app).toContain('selectedQuoteComparisonDetail?.title');
    expect(app).toContain('displayedQuoteRfqs.length');
    expect(app).toContain("orders: {");
    expect(app).toContain('selectedOrderDetail?.id');
    expect(app).toContain('displayedOrderFulfillmentRows.length');
    expect(app).toContain("receipts: {");
    expect(app).toContain('selectedReceiptDetail?.id');
    expect(app).toContain('displayedReceiptInspectionRows.length');
    expect(app).toContain("invoices: {");
    expect(app).toContain('selectedInvoiceDetail?.id');
    expect(app).toContain('displayedInvoicePaymentRows.length');
  });

  it('records the eleventh stage-seven increment as buyer demo presentation polish', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(checklist).toContain('| 11 | 采购方演示态细节收敛第一轮 |');
    expect(checklist).toContain('scripts/stage-seven-demo-presentation-polish-ui.test.ts');
    expect(checklist).toContain('供应商侧协同演示补强');
  });
});
