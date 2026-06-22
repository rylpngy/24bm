import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract fulfillment finance summary', () => {
  it('renders contract fulfillment, invoice, payment and archive blocking summary in contract detail', () => {
    const app = read('App.tsx');
    const buyerUi = read('data/buyerAdminUi.ts');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(buyerUi).toContain('fulfillmentFinanceRows');
    expect(buyerUi).toContain('contractFinancialSummary');
    expect(buyerUi).toContain('invoiceVarianceLabel');
    expect(buyerUi).toContain('paymentReadinessLabel');

    expect(app).toContain('合同履约财务汇总');
    expect(app).toContain('合同金额');
    expect(app).toContain('收货状态');
    expect(app).toContain('发票金额');
    expect(app).toContain('付款状态');
    expect(app).toContain('归档阻断');
    expect(app).toContain('付款准备');

    expect(checklist).toContain('| 27 | 合同履约财务汇总 |');
    expect(walkthrough).toContain('合同履约财务汇总');
  });
});
