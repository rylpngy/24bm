import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier action loop summary UI', () => {
  it('summarizes supplier quote, order, delivery, invoice, and receivable actions', () => {
    const app = read('App.tsx');
    const supplierWorkspace = app.slice(
      app.indexOf('const SupplierWorkspaceView'),
      app.indexOf('const SupplierOpportunityResponseSummaryPanel'),
    );

    expect(supplierWorkspace).toContain('SupplierActionLoopSummaryPanel');
    expect(supplierWorkspace).toContain('操作闭环摘要');
    expect(supplierWorkspace).toContain('pendingQuoteCount');
    expect(supplierWorkspace).toContain('pendingConfirmCount');
    expect(supplierWorkspace).toContain('pendingDeliveryCount');
    expect(supplierWorkspace).toContain('invoiceReadyCount');
    expect(supplierWorkspace).toContain('pendingReceivableCount');
    expect(supplierWorkspace).toContain('待报价');
    expect(supplierWorkspace).toContain('待确认');
    expect(supplierWorkspace).toContain('待发货');
    expect(supplierWorkspace).toContain('可开票');
    expect(supplierWorkspace).toContain('待回款');
  });
});
