import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier action forms UI', () => {
  it('collects quote, delivery, and invoice inputs before calling supplier actions', () => {
    const app = read('App.tsx');
    const supplierWorkspace = app.slice(
      app.indexOf('const SupplierWorkspaceView'),
      app.indexOf('const SupplierProfileSummaryPanel'),
    );

    expect(app).toContain('type SupplierQuoteDraft');
    expect(app).toContain('type SupplierDeliveryDraft');
    expect(app).toContain('type SupplierInvoiceDraft');
    expect(app).toContain('submitSupplierQuote = async (rfqId: string, draft: SupplierQuoteDraft)');
    expect(app).toContain('createSupplierDelivery = async (orderId: string, draft: SupplierDeliveryDraft)');
    expect(app).toContain('createSupplierInvoice = async (orderId: string, draft: SupplierInvoiceDraft)');
    expect(supplierWorkspace).toContain('quoteDrafts');
    expect(supplierWorkspace).toContain('deliveryDrafts');
    expect(supplierWorkspace).toContain('invoiceDrafts');
    expect(supplierWorkspace).toContain('报价金额');
    expect(supplierWorkspace).toContain('税率');
    expect(supplierWorkspace).toContain('交付天数');
    expect(supplierWorkspace).toContain('承运商');
    expect(supplierWorkspace).toContain('物流单号');
    expect(supplierWorkspace).toContain('发票号');
    expect(supplierWorkspace).toContain('onSubmitQuote(rfq.id, quoteDraft)');
    expect(supplierWorkspace).toContain('onCreateDelivery(order.id, deliveryDraft)');
    expect(supplierWorkspace).toContain('onCreateInvoice(order.id, invoiceDraft)');
  });
});
