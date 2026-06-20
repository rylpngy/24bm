import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer invoice detail UI', () => {
  it('connects invoice payment selections to an invoice detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');
    const invoiceDetailView = app.slice(
      app.indexOf('const InvoicePaymentDetailPanelView'),
      app.indexOf('const SupplierDetailPanelView'),
    );

    expect(buyerAdminUi).toContain('buildInvoicePaymentDetailPanel');
    expect(buyerAdminUi).toContain('orderFacts');
    expect(buyerAdminUi).toContain('paymentCheckRows');
    expect(buyerAdminUi).toContain('relatedRows');
    expect(buyerAdminUi).toContain('paymentTimelineRows');

    expect(app).toContain('buildInvoicePaymentDetailPanel');
    expect(app).toContain('selectedInvoiceId');
    expect(app).toContain('setSelectedInvoiceId');
    expect(app).toContain('InvoicePaymentDetailPanelView');
    expect(invoiceDetailView).toContain('发票详情');
    expect(invoiceDetailView).toContain('订单上下文');
    expect(invoiceDetailView).toContain('对账单摘要');
    expect(invoiceDetailView).toContain('付款检查');
    expect(invoiceDetailView).toContain('paymentCheckRows');
    expect(invoiceDetailView).toContain('关联业务');
    expect(invoiceDetailView).toContain('付款轨迹');
  });

  it('surfaces payment registration actions inside the invoice detail panel', () => {
    const app = read('App.tsx');
    const invoiceDetailView = app.slice(
      app.indexOf('const InvoicePaymentDetailPanelView'),
      app.indexOf('const SupplierDetailPanelView'),
    );

    expect(invoiceDetailView).toContain('InvoicePaymentOperationPanel');
    expect(invoiceDetailView).toContain('付款操作');
    expect(invoiceDetailView).toContain('invoice?: BuyerWorkspace[\'invoices\'][number]');
    expect(invoiceDetailView).toContain('busy: boolean');
    expect(invoiceDetailView).toContain('javaEnabled: boolean');
    expect(invoiceDetailView).toContain('paymentDraft?: BuyerPaymentDraft');
    expect(invoiceDetailView).toContain('onRegisterPayment: (invoiceId: string, draft: BuyerPaymentDraft) => void');
    expect(app).toContain('invoice={selectedInvoiceRecord}');
    expect(app).toContain('busy={buyerFulfillmentBusyId === `payment:${selectedInvoice}`}');
    expect(app).toContain('onRegisterPayment={onRegisterPayment}');
  });

  it('places payment, reconciliation, and next action summary in the top invoice detail card', () => {
    const app = read('App.tsx');
    const invoiceDetailView = app.slice(
      app.indexOf('const InvoicePaymentDetailPanelView'),
      app.indexOf('const InvoicePaymentOperationPanel'),
    );
    const topCard = invoiceDetailView.slice(
      invoiceDetailView.indexOf('<DetailHeroCard'),
      invoiceDetailView.indexOf('<section>'),
    );

    expect(invoiceDetailView).toContain('const paymentStatus = detail?.facts.find((fact) => fact.label === \'付款状态\')?.value ?? \'待付款\';');
    expect(invoiceDetailView).toContain('const reconciliationStatus = invoice?.reconciliationStatus ?? (detail && invoiceAmount === orderAmount ? \'金额一致\' : \'待核对\');');
    expect(invoiceDetailView).toContain('invoice?.orderAmount');
    expect(invoiceDetailView).toContain('invoice?.varianceAmount');
    expect(invoiceDetailView).toContain('invoice?.receiptStatus');
    expect(topCard).toContain('summaryFacts={[');
    expect(topCard).toContain("{ label: '付款状态', value: paymentStatus }");
    expect(topCard).toContain("{ label: '对账状态', value: reconciliationStatus }");
    expect(topCard).toContain("{ label: '下一步', value: detail.nextActionTitle }");
  });
});
