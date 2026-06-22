import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch block action hints UI', () => {
  it('maps payment block reasons to actionable finance follow-up hints', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('describePaymentBatchBlockAction');
    expect(ledgerPanel).toContain('差异未处理');
    expect(ledgerPanel).toContain('处理差异后恢复付款申请');
    expect(ledgerPanel).toContain('三单未同步');
    expect(ledgerPanel).toContain('先重建或同步三单匹配');
    expect(ledgerPanel).toContain('三单未通过');
    expect(ledgerPanel).toContain('先处理收货、订单或发票差异');
    expect(ledgerPanel).toContain('付款申请审批中');
    expect(ledgerPanel).toContain('在批次内付款申请中推进审批');
    expect(ledgerPanel).toContain('付款申请未通过');
    expect(ledgerPanel).toContain('重新提交或调整付款申请');
  });

  it('renders action hints and destination hints in the block queue cards', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('blockActionHint');
    expect(ledgerPanel).toContain('blockActionTarget');
    expect(ledgerPanel).toContain('处理建议');
    expect(ledgerPanel).toContain('处理入口');
    expect(ledgerPanel).toContain('定位后处理');
  });

  it('records the forty second stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第42轮');
    expect(checklist).toContain('付款阻断处理建议');
    expect(checklist).toContain('scripts/payment-batch-block-action-hints-ui.test.ts');
  });
});
