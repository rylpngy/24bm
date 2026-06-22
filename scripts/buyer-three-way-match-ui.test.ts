import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer three way match UI', () => {
  it('adds a three way match section to buyer invoice payment detail', () => {
    const app = read('App.tsx');
    const invoiceDetailView = app.slice(
      app.indexOf('const InvoicePaymentDetailPanelView'),
      app.indexOf('const InvoicePaymentOperationPanel'),
    );

    expect(invoiceDetailView).toContain('const threeWayMatchStatus');
    expect(invoiceDetailView).toContain('const threeWayMatchBlockingLabel');
    expect(invoiceDetailView).toContain('DetailSection title="三单匹配"');
    expect(invoiceDetailView).toContain('MiniFact label="订单金额"');
    expect(invoiceDetailView).toContain('MiniFact label="收货状态"');
    expect(invoiceDetailView).toContain('MiniFact label="发票金额"');
    expect(invoiceDetailView).toContain('MiniFact label="匹配结论"');
    expect(invoiceDetailView).toContain('MiniFact label="付款边界"');
    expect(invoiceDetailView).toContain('付款前请先完成三单匹配核对');
  });

  it('surfaces three way match status inside the reconciliation ledger', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('buildThreeWayMatchLabel');
    expect(ledgerPanel).toContain('threeWayMatchPassCount');
    expect(ledgerPanel).toContain('三单匹配');
    expect(ledgerPanel).toContain('匹配结论');
    expect(ledgerPanel).toContain('待收货核对');
    expect(ledgerPanel).toContain('金额差异待处理');
    expect(ledgerPanel).toContain('三单匹配通过');
  });

  it('records the stage four finance deepening scope and verification boundary', () => {
    const docPath = 'docs/stage-four-finance-deepening-plan.md';
    expect(existsSync(docPath)).toBe(true);

    const doc = read(docPath);
    expect(doc).toContain('# 阶段四第一轮：财务协同深化');
    expect(doc).toContain('三单匹配：订单、收货、发票');
    expect(doc).toContain('采购方发票付款');
    expect(doc).toContain('应付对账单台账');
    expect(doc).toContain('不新增 Java API');
    expect(doc).toContain('scripts/buyer-three-way-match-ui.test.ts');
  });
});
