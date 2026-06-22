import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = () => readFileSync('App.tsx', 'utf8');

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  return source.slice(startIndex, endIndex);
};

describe('supplier business handoff UI', () => {
  it('reuses the selected business handoff panel across supplier collaboration modules', () => {
    const source = app();
    const supplierWorkspace = sliceBetween(source, 'const SupplierWorkspace', 'const SupplierActionLoopSummaryPanel');
    const opportunityModule = sliceBetween(source, "{activeModule === 'opportunities'", "{activeModule === 'quotes'");
    const quoteModule = sliceBetween(source, '<Panel title="报价记录"', "{activeModule === 'profile'");
    const orderModule = sliceBetween(source, '<Panel title="销售订单与发货"', "{activeModule === 'invoices'");
    const invoiceModule = sliceBetween(source, '<Panel title="发票与应收"', 'const SupplierOverviewSummaryPanel');

    expect(supplierWorkspace).toContain('selectedSupplierOpportunity');
    expect(supplierWorkspace).toContain('describeSupplierOpportunityNextAction');
    expect(supplierWorkspace).toContain('describeSupplierQuoteNextAction');
    expect(supplierWorkspace).toContain('describeSupplierOrderNextAction');
    expect(supplierWorkspace).toContain('describeSupplierInvoiceNextAction');

    expect(opportunityModule).toContain('<SelectedBusinessHandoffPanel');
    expect(opportunityModule).toContain('moduleLabel="询价邀请"');
    expect(opportunityModule).toContain('nextActionTitle={describeSupplierOpportunityNextAction(selectedSupplierOpportunity, workspace.supplier.id)}');

    expect(quoteModule).toContain('<SelectedBusinessHandoffPanel');
    expect(quoteModule).toContain('moduleLabel="报价记录"');
    expect(quoteModule).toContain('nextActionTitle={describeSupplierQuoteNextAction(selectedSupplierQuoteDetail, selectedSupplierQuoteRfq)}');

    expect(orderModule).toContain('<SelectedBusinessHandoffPanel');
    expect(orderModule).toContain('moduleLabel="销售订单"');
    expect(orderModule).toContain('nextActionTitle={describeSupplierOrderNextAction(selectedSupplierOrderDetail, selectedSupplierOrderDelivery, selectedSupplierOrderInvoice)}');

    expect(invoiceModule).toContain('<SelectedBusinessHandoffPanel');
    expect(invoiceModule).toContain('moduleLabel="发票应收"');
    expect(invoiceModule).toContain('nextActionTitle={describeSupplierInvoiceNextAction(selectedSupplierInvoiceDetail)}');
  });

  it('records supplier handoff progress in the stage checklist', () => {
    const checklist = readFileSync('docs/stage-three-round-two-execution-checklist.md', 'utf8');

    expect(checklist).toContain('供应商端业务接力提示');
    expect(checklist).toContain('询价邀请、报价记录、销售订单和发票应收模块已补');
    expect(checklist).toContain('供应商侧下一处理、详情核对和处理边界');
    expect(checklist).toContain('scripts/supplier-business-handoff-ui.test.ts');
  });
});
