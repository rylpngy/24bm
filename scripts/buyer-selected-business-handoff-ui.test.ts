import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = () => readFileSync('App.tsx', 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('buyer selected business handoff UI', () => {
  it('adds a shared selected business handoff panel for buyer workflow modules', () => {
    const source = app();
    const handoffPanel = sliceBetween(source, 'const SelectedBusinessHandoffPanel', 'const StatusFilterControl');

    expect(handoffPanel).toContain('业务接力提示');
    expect(handoffPanel).toContain('当前选中');
    expect(handoffPanel).toContain('下一处理');
    expect(handoffPanel).toContain('详情核对');
    expect(handoffPanel).toContain('处理边界');
    expect(handoffPanel).toContain('aria-label={`${moduleLabel} 业务接力提示`}');
  });

  it('surfaces the handoff panel in the five buyer core workflow modules', () => {
    const source = app();
    const demandModule = sliceBetween(source, '<Panel title="采购需求列表"', '<DemandDetailPanelView');
    const rfqModule = sliceBetween(source, '<Panel title="询价项目"', '<RfqDetailPanelView');
    const quoteModule = sliceBetween(source, "{activeModule === 'quotes'", '<QuoteComparisonDetailPanelView');
    const orderModule = sliceBetween(source, "{activeModule === 'orders'", '<OrderDetailPanelView');
    const invoiceModule = sliceBetween(source, "{activeModule === 'invoices'", '<InvoicePaymentDetailPanelView');

    expect(demandModule).toContain('<SelectedBusinessHandoffPanel');
    expect(demandModule).toContain('moduleLabel="采购需求"');
    expect(demandModule).toContain('nextActionTitle={selectedDemandDetail?.nextActionTitle}');

    expect(rfqModule).toContain('<SelectedBusinessHandoffPanel');
    expect(rfqModule).toContain('moduleLabel="询价项目"');
    expect(rfqModule).toContain('nextActionTitle={selectedRfqDetail?.nextActionTitle}');

    expect(quoteModule).toContain('<SelectedBusinessHandoffPanel');
    expect(quoteModule).toContain('moduleLabel="报价对比"');
    expect(quoteModule).toContain('nextActionTitle={selectedQuoteComparisonDetail?.nextActionTitle}');

    expect(orderModule).toContain('<SelectedBusinessHandoffPanel');
    expect(orderModule).toContain('moduleLabel="采购订单"');
    expect(orderModule).toContain('nextActionTitle={selectedOrderDetail?.nextActionTitle}');

    expect(invoiceModule).toContain('<SelectedBusinessHandoffPanel');
    expect(invoiceModule).toContain('moduleLabel="发票付款"');
    expect(invoiceModule).toContain('nextActionTitle={selectedInvoiceDetail?.nextActionTitle}');
  });
});
