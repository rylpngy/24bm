import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch resolution stage filter UI', () => {
  it('derives a filtered resolution queue view for the selected batch reason', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('paymentBatchResolutionStageFilter');
    expect(ledgerPanel).toContain('paymentBatchResolutionStageFilterOptions');
    expect(ledgerPanel).toContain('filteredPaymentBatchReasonResolutionRows');
    expect(ledgerPanel).toContain("paymentBatchResolutionStageFilter === '全部处理状态'");
    expect(ledgerPanel).toContain('row.blockResolutionStage === paymentBatchResolutionStageFilter');
  });

  it('renders resolution stage filter controls and filtered queue feedback', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('处理状态筛选');
    expect(ledgerPanel).toContain('全部处理状态');
    expect(ledgerPanel).toContain('当前处理筛选');
    expect(ledgerPanel).toContain('筛选后记录');
    expect(ledgerPanel).toContain('当前处理状态下暂无阻断明细');
    expect(ledgerPanel).toContain('切换为全部处理状态');
  });

  it('records the forty seventh stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第47轮');
    expect(checklist).toContain('付款阻断处理状态筛选');
    expect(checklist).toContain('scripts/payment-batch-resolution-stage-filter-ui.test.ts');
  });
});
