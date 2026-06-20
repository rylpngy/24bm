import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('invoice reconciliation ledger UI', () => {
  it('renders buyer and supplier reconciliation ledger sections from invoice records', () => {
    const app = read('App.tsx');
    const buyerInvoicesModule = app.slice(
      app.indexOf("{activeModule === 'invoices' && ("),
      app.indexOf("{activeModule === 'audit' && ("),
    );
    const supplierInvoicesModule = app.slice(
      app.indexOf("{activeModule === 'invoices' && (", app.indexOf('const SupplierWorkspaceView')),
      app.indexOf('const SupplierProfilePanel'),
    );

    expect(app).toContain('const ReconciliationLedgerPanel');
    expect(app).toContain('reconciliationLedgerStatusFilter');
    expect(app).toContain('setReconciliationLedgerStatusFilter');
    expect(app).toContain('invoice.reconciliationStatus');
    expect(app).toContain('invoice.reconciliationNo');
    expect(app).toContain('invoice.reconciliationStage');
    expect(app).toContain('invoice.nextReconciliationAction');
    expect(app).toContain('invoice.orderAmount');
    expect(app).toContain('invoice.varianceAmount');
    expect(app).toContain('invoice.receiptStatus');
    expect(app).toContain('对账单编号');
    expect(app).toContain('状态流转');
    expect(app).toContain('下一步动作');
    expect(app).toContain('对账单台账');
    expect(app).toContain('对账状态筛选');
    expect(app).toContain('差异金额');
    expect(app).toContain('收货状态');

    expect(buyerInvoicesModule).toContain('<ReconciliationLedgerPanel');
    expect(buyerInvoicesModule).toContain('title="应付对账单台账"');
    expect(buyerInvoicesModule).toContain('invoices={workspace.invoices}');
    expect(buyerInvoicesModule).toContain('scope="buyer"');

    expect(supplierInvoicesModule).toContain('<ReconciliationLedgerPanel');
    expect(supplierInvoicesModule).toContain('title="应收对账单台账"');
    expect(supplierInvoicesModule).toContain('invoices={workspace.invoices}');
    expect(supplierInvoicesModule).toContain('scope="supplier"');
  });

  it('upgrades reconciliation ledger into a finance-style table with mobile cards', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('invoiceTotal');
    expect(ledgerPanel).toContain('overdueCount');
    expect(ledgerPanel).toContain('nextActionSummary');
    expect(ledgerPanel).toContain('<ResponsiveTableFrame');
    expect(ledgerPanel).toContain('mobileCards={');
    expect(ledgerPanel).toContain('<table className="min-w-full divide-y divide-slate-200 text-left text-sm">');
    expect(ledgerPanel).toContain('<th className="px-3 py-2">对账单</th>');
    expect(ledgerPanel).toContain('<th className="px-3 py-2">订单 / 发票</th>');
    expect(ledgerPanel).toContain('<th className="px-3 py-2 text-right">订单金额</th>');
    expect(ledgerPanel).toContain('<th className="px-3 py-2 text-right">发票金额</th>');
    expect(ledgerPanel).toContain('<th className="px-3 py-2 text-right">差异</th>');
    expect(ledgerPanel).toContain('<th className="px-3 py-2">状态流转</th>');
    expect(ledgerPanel).toContain('<th className="px-3 py-2">下一步</th>');
    expect(ledgerPanel).toContain('逾期提醒');
    expect(ledgerPanel).toContain('invoice.dueDate');
  });
});
