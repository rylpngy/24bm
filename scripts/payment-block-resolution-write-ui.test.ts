import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment block resolution write UI', () => {
  it('wires payment block resolution create and update handlers to Java APIs', () => {
    const app = read('App.tsx');

    expect(app).toContain('saveBuyerPaymentBlockResolutionStatus');
    expect(app).toContain('createBuyerPaymentBlockResolution');
    expect(app).toContain('updateBuyerPaymentBlockResolutionStatus');
    expect(app).toContain('setBuyerFulfillmentBusyId(`payment-block-resolution:${payload.paymentRequestId}:${payload.blockReason}`)');
    expect(app).toContain('setBuyerData(await refreshJavaBuyerData(buyerData))');
    expect(app).toContain('付款阻断处理状态已保存');
  });

  it('passes the write handler into the buyer reconciliation ledger', () => {
    const app = read('App.tsx');

    expect(app).toContain('onSavePaymentBlockResolutionStatus');
    expect(app).toContain('onSavePaymentBlockResolutionStatus={saveBuyerPaymentBlockResolutionStatus}');
    expect(app).toContain('onSavePaymentBlockResolutionStatus={onSavePaymentBlockResolutionStatus}');
  });

  it('renders persisted resolution write actions in block queue cards', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('resolutionBusyId');
    expect(ledgerPanel).toContain('保存处理状态');
    expect(ledgerPanel).toContain('标记处理中');
    expect(ledgerPanel).toContain('标记已处理待刷新');
    expect(ledgerPanel).toContain('onSavePaymentBlockResolutionStatus({');
    expect(ledgerPanel).toContain("resolutionStatus: '处理中'");
    expect(ledgerPanel).toContain("resolutionStatus: '已处理待刷新'");
  });

  it('records the fifty third stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第53轮');
    expect(checklist).toContain('付款阻断处理状态页面写入');
    expect(checklist).toContain('scripts/payment-block-resolution-write-ui.test.ts');
  });
});
