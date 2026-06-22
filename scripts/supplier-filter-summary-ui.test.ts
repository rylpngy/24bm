import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier filter summary UI', () => {
  it('adds status filters and result summaries for supplier workflow lists', () => {
    const app = read('App.tsx');
    const supplierWorkspace = app.slice(
      app.indexOf('const SupplierWorkspaceView'),
      app.indexOf('const SupplierProfileSummaryPanel'),
    );

    expect(supplierWorkspace).toContain('opportunityStatusFilter');
    expect(supplierWorkspace).toContain('quoteStatusFilter');
    expect(supplierWorkspace).toContain('supplierOrderStatusFilter');
    expect(supplierWorkspace).toContain('supplierInvoiceStatusFilter');
    expect(supplierWorkspace).toContain('filteredSupplierOpportunities');
    expect(supplierWorkspace).toContain('filteredSupplierQuotes');
    expect(supplierWorkspace).toContain('filteredSupplierOrders');
    expect(supplierWorkspace).toContain('filteredSupplierInvoices');

    expect(supplierWorkspace).toContain('label="商机状态"');
    expect(supplierWorkspace).toContain('label="报价状态"');
    expect(supplierWorkspace).toContain('label="销售订单状态"');
    expect(supplierWorkspace).toContain('label="应收状态"');
    expect(supplierWorkspace).toContain('label="询价邀请筛选结果"');
    expect(supplierWorkspace).toContain('label="报价记录筛选结果"');
    expect(supplierWorkspace).toContain('label="销售订单筛选结果"');
    expect(supplierWorkspace).toContain('label="发票应收筛选结果"');
    expect(supplierWorkspace).toContain('onClear={() => setOpportunityStatusFilter(\'全部状态\')}');
    expect(supplierWorkspace).toContain('onClear={() => setQuoteStatusFilter(\'全部状态\')}');
    expect(supplierWorkspace).toContain('onClear={() => setSupplierOrderStatusFilter(\'全部状态\')}');
    expect(supplierWorkspace).toContain('onClear={() => setSupplierInvoiceStatusFilter(\'全部状态\')}');
  });
});
