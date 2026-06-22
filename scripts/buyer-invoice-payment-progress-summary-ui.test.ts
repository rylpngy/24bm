import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = () => readFileSync('App.tsx', 'utf8');
const checklist = () => readFileSync('docs/stage-three-round-two-execution-checklist.md', 'utf8');

describe('buyer invoice payment progress summary UI', () => {
  it('surfaces invoice payment progress summary before reconciliation ledger', () => {
    const source = app();
    const buyerWorkspace = source.slice(
      source.indexOf('const BuyerWorkspaceView'),
      source.indexOf('const DemandDetailPanelView'),
    );
    const invoiceModule = source.slice(
      source.indexOf('<Panel title="发票付款"'),
      source.indexOf('<ReconciliationLedgerPanel'),
    );

    expect(buyerWorkspace).toContain('invoicePendingIssueCount');
    expect(buyerWorkspace).toContain('invoicePendingReconciliationCount');
    expect(buyerWorkspace).toContain('invoiceVariancePendingCount');
    expect(buyerWorkspace).toContain('invoicePendingPaymentCount');
    expect(buyerWorkspace).toContain('invoicePaidCount');
    expect(invoiceModule).toContain('发票付款推进摘要');
    expect(invoiceModule).toContain('待开票');
    expect(invoiceModule).toContain('待对账');
    expect(invoiceModule).toContain('差异待处理');
    expect(invoiceModule).toContain('待付款');
    expect(invoiceModule).toContain('已付款');
    expect(invoiceModule).toContain('先完成开票和对账，再处理差异并登记付款。');
  });

  it('records the sixty sixth stage-three buyer flow increment in the checklist', () => {
    const docs = checklist();

    expect(docs).toContain('| 66 | 发票付款推进摘要 |');
    expect(docs).toContain('scripts/buyer-invoice-payment-progress-summary-ui.test.ts');
    expect(docs).toContain('发票付款推进摘要');
  });
});
