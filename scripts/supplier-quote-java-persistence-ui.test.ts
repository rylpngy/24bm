import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('supplier quote Java persistence UI', () => {
  it('wires supplier quote updates from the detail panel to the Java API client', () => {
    const app = read('App.tsx');
    const client = read('services/procurementApiClient.ts');
    const supplierWorkspace = sliceBetween(app, 'const SupplierWorkspaceView', 'const SupplierProfileCapabilityCard');
    const quoteDetailPanel = sliceBetween(app, 'const SupplierQuoteDetailPanel', 'const SupplierOrderFulfillmentDetailPanel');

    expect(client).toContain('updateSupplierQuote(quoteId: string');
    expect(client).toContain('PUT');
    expect(client).toContain('/api/v1/supplier/quotes/${quoteId}');
    expect(app).toContain('const updateSupplierQuote = async');
    expect(app).toContain('javaApiClient.updateSupplierQuote');
    expect(app).toContain('报价记录已保存并已通知采购方重新比价');
    expect(supplierWorkspace).toContain('quoteUpdateDrafts');
    expect(supplierWorkspace).toContain('onUpdateQuote');
    expect(quoteDetailPanel).toContain('supplierActionBusyId === `quote-update:${quote.id}`');
    expect(quoteDetailPanel).toContain('修改报价');
    expect(quoteDetailPanel).toContain('保存报价修改');
    expect(quoteDetailPanel).toContain('updateDraft.amount <= 0');
    expect(quoteDetailPanel).toContain('报价仍在 RFQ 报价期内时可修改');
  });
});
