import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer invoice detail edit UI', () => {
  it('adds an editable invoice payment form with Java save, supplier receivable sync, and refresh feedback', () => {
    const app = read('App.tsx');
    const invoiceDetail = app.slice(
      app.indexOf('const InvoicePaymentDetailPanelView'),
      app.indexOf('const InvoicePaymentOperationPanel'),
    );
    const buyerWorkspace = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const DemandDetailPanelView'),
    );

    expect(app).toContain('updateBuyerInvoice');
    expect(app).toContain('invoiceUpdateBusyId');
    expect(app).toContain('updateBuyerInvoiceDetail');
    expect(buyerWorkspace).toContain('onUpdateInvoice={onUpdateInvoice}');
    expect(invoiceDetail).toContain('发票付款编辑');
    expect(invoiceDetail).toContain('保存发票付款修改');
    expect(app).toContain('发票付款已保存、已同步供应商应收并刷新后回显');
    expect(invoiceDetail).toContain('保存后会同步供应商应收并重新加载 Java 数据回显');
    expect(invoiceDetail).toContain('已付款发票不可再修改付款状态');
    expect(invoiceDetail).toContain('editableInvoicePaymentStatus');
    expect(invoiceDetail).toContain('onUpdateInvoice(invoice.id');
  });
});
