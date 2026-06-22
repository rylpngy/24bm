import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment block resolution Java UI integration', () => {
  it('passes Java payment block resolutions into the buyer reconciliation ledger', () => {
    const app = read('App.tsx');

    expect(app).toContain('paymentBlockResolutions: PaymentBlockResolutionRecord[]');
    expect(app).toContain('paymentBlockResolutions: javaBuyerMasterData.paymentBlockResolutions ?? []');
    expect(app).toContain('const paymentBlockResolutions = javaBuyerMasterData?.paymentBlockResolutions ?? []');
    expect(app).toContain('paymentBlockResolutions={buyerData.paymentBlockResolutions}');
    expect(app).toContain('paymentBlockResolutions={paymentBlockResolutions}');
  });

  it('uses persisted Java resolution rows before derived queue status in block cards', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('paymentBlockResolutionByKey');
    expect(ledgerPanel).toContain('findPaymentBlockResolutionForRow');
    expect(ledgerPanel).toContain('javaResolution?.resolutionStatus');
    expect(ledgerPanel).toContain('javaResolution?.nextStep');
    expect(ledgerPanel).toContain('javaResolution?.resolutionAction');
    expect(ledgerPanel).toContain("blockResolutionSource: 'Java处理台账'");
    expect(ledgerPanel).toContain("blockResolutionSource: '前端派生状态'");
  });

  it('renders persisted resolution status, action, next step, and source in the queue card', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('处理来源');
    expect(ledgerPanel).toContain('处理动作');
    expect(ledgerPanel).toContain('下一步');
    expect(ledgerPanel).toContain('row.blockResolutionSource');
    expect(ledgerPanel).toContain('row.blockResolutionAction');
    expect(ledgerPanel).toContain('row.blockResolutionNextStep');
  });

  it('records the fifty second stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第52轮');
    expect(checklist).toContain('付款阻断处理状态前端接入');
    expect(checklist).toContain('scripts/payment-block-resolution-java-ui.test.ts');
  });
});
