import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch resolution action entry UI', () => {
  it('derives action entries for each payment block resolution stage', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('describePaymentBatchResolutionAction');
    expect(ledgerPanel).toContain('resolutionActionLabel');
    expect(ledgerPanel).toContain('resolutionActionTarget');
    expect(ledgerPanel).toContain('resolutionActionBoundary');
    expect(ledgerPanel).toContain('row.blockResolutionStage');
  });

  it('renders the action entry fields in filtered resolution queue cards', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('下一步动作');
    expect(ledgerPanel).toContain('定位入口');
    expect(ledgerPanel).toContain('操作边界');
    expect(ledgerPanel).toContain('处理该阻断');
    expect(ledgerPanel).toContain('刷新执行记录');
    expect(ledgerPanel).toContain('保持观察');
  });

  it('records the forty eighth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第48轮');
    expect(checklist).toContain('付款阻断处理动作入口');
    expect(checklist).toContain('scripts/payment-batch-resolution-action-entry-ui.test.ts');
  });
});
