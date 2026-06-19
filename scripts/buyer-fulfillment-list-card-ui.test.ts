import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer fulfillment list card UI', () => {
  it('uses a shared workflow list card for order, receipt, and invoice rows', () => {
    const app = read('App.tsx');

    expect(app).toContain('const WorkflowListCard');
    expect(app).toContain('title: string;');
    expect(app).toContain('meta: string;');
    expect(app).toContain('amountLabel?: string;');
    expect(app).toContain('status: string;');
    expect(app).toContain('facts?: Array<{ label: string; value: string }>;');
    expect(app).toContain('nextAction: BuyerNextAction;');
    expect(app).toContain('detailSelected: boolean;');
    expect(app).toContain('onSelectDetail: () => void;');
    expect(app).toContain('action?: React.ReactNode;');
    expect(app).toContain('aria-label={`${title} 操作区`}');
    expect(app).toContain('compact?: boolean;');
    expect(app).toContain("compact ? '' : 'mt-3'");
  });

  it('keeps fulfillment card amounts and actions readable on narrow screens', () => {
    const app = read('App.tsx');
    const workflowCard = app.slice(
      app.indexOf('const WorkflowListCard'),
      app.indexOf('const SimpleList'),
    );

    expect(workflowCard).toContain('flex flex-col gap-3 md:flex-row md:items-start md:justify-between');
    expect(workflowCard).toContain('break-words');
    expect(workflowCard).toContain('self-start rounded-lg bg-slate-50 px-2 py-1');
    expect(workflowCard).toContain('sm:w-auto');
    expect(workflowCard).toContain('sm:justify-between');
    expect(workflowCard).not.toContain('sm:flex-row sm:items-start sm:justify-between');
  });

  it('applies the shared workflow card to fulfillment list modules', () => {
    const app = read('App.tsx');

    const orderModule = app.slice(
      app.indexOf("{activeModule === 'orders'"),
      app.indexOf('<OrderDetailPanelView'),
    );
    const receiptModule = app.slice(
      app.indexOf("{activeModule === 'receipts'"),
      app.indexOf('<ReceiptInspectionDetailPanelView'),
    );
    const invoiceModule = app.slice(
      app.indexOf("{activeModule === 'invoices'"),
      app.indexOf('<InvoicePaymentDetailPanelView'),
    );

    expect(orderModule).toContain('<WorkflowListCard');
    expect(orderModule).toContain('title={orderRow.id}');
    expect(orderModule).toContain('meta={orderRow.supplierName}');
    expect(orderModule).toContain('amountLabel={orderRow.amountLabel}');
    expect(orderModule).toContain('facts={orderRow.facts}');
    expect(orderModule).toContain('status={orderRow.status}');
    expect(orderModule).toContain('nextAction={orderRow.nextAction}');

    expect(receiptModule).toContain('<WorkflowListCard');
    expect(receiptModule).toContain('title={orderRow.id}');
    expect(receiptModule).toContain('meta={`${orderRow.supplierName} · ${orderRow.logisticsLabel}`}');
    expect(receiptModule).toContain('status={orderRow.status}');
    expect(receiptModule).toContain('nextAction={orderRow.nextAction}');

    expect(invoiceModule).toContain('<WorkflowListCard');
    expect(invoiceModule).toContain('title={invoiceRow.id}');
    expect(invoiceModule).toContain('meta={`${invoiceRow.supplierName} · ${invoiceRow.orderLabel}`}');
    expect(invoiceModule).toContain('amountLabel={invoiceRow.amountLabel}');
    expect(invoiceModule).toContain('status={invoiceRow.status}');
    expect(invoiceModule).toContain('nextAction={invoiceRow.nextAction}');
  });
});
