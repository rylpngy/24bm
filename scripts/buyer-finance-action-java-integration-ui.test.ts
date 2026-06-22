import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer finance action Java integration UI', () => {
  it('loads Java payment requests and variance handlings into buyer master data', () => {
    const client = read('services/procurementApiClient.ts');

    expect(client).toContain('paymentRequests?: PaymentRequestRecord[]');
    expect(client).toContain('varianceHandlings?: VarianceHandlingRecord[]');
    expect(client).toContain('client.listBuyerPaymentRequests()');
    expect(client).toContain('client.listBuyerVarianceHandlings()');
    expect(client).toContain('paymentRequests,');
    expect(client).toContain('varianceHandlings,');
  });

  it('passes finance action records through the buyer workspace and invoice detail', () => {
    const app = read('App.tsx');
    const buyerWorkspaceType = app.slice(
      app.indexOf('const BuyerWorkspaceView: React.FC<{'),
      app.indexOf('}> = ({', app.indexOf('const BuyerWorkspaceView: React.FC<{')),
    );
    const invoiceModule = app.slice(
      app.indexOf("{activeModule === 'invoices' && ("),
      app.indexOf("{activeModule === 'audit' && ("),
    );
    const invoiceDetailView = app.slice(
      app.indexOf('const InvoicePaymentDetailPanelView'),
      app.indexOf('const InvoicePaymentOperationPanel'),
    );

    expect(app).toContain('paymentRequests: PaymentRequestRecord[]');
    expect(app).toContain('varianceHandlings: VarianceHandlingRecord[]');
    expect(buyerWorkspaceType).toContain('paymentRequests: PaymentRequestRecord[]');
    expect(buyerWorkspaceType).toContain('varianceHandlings: VarianceHandlingRecord[]');
    expect(buyerWorkspaceType).toContain('onCreatePaymentRequest');
    expect(buyerWorkspaceType).toContain('onCreateVarianceHandling');
    expect(invoiceModule).toContain('selectedPaymentRequestRecord');
    expect(invoiceModule).toContain('selectedVarianceHandlingRecord');
    expect(invoiceModule).toContain('paymentRequest={selectedPaymentRequestRecord}');
    expect(invoiceModule).toContain('varianceHandling={selectedVarianceHandlingRecord}');
    expect(invoiceDetailView).toContain('paymentRequest?: PaymentRequestRecord');
    expect(invoiceDetailView).toContain('varianceHandling?: VarianceHandlingRecord');
    expect(invoiceDetailView).toContain('paymentRequest?.requestStatus');
    expect(invoiceDetailView).toContain('varianceHandling?.result');
  });

  it('adds Java-backed create actions for payment request and variance handling records', () => {
    const app = read('App.tsx');
    const invoiceDetailView = app.slice(
      app.indexOf('const InvoicePaymentDetailPanelView'),
      app.indexOf('const InvoicePaymentOperationPanel'),
    );

    expect(app).toContain('createBuyerPaymentRequestRecord');
    expect(app).toContain('createBuyerVarianceHandlingRecord');
    expect(app).toContain('javaApiClient.createBuyerPaymentRequest');
    expect(app).toContain('javaApiClient.createBuyerVarianceHandling');
    expect(invoiceDetailView).toContain('onCreatePaymentRequest: (invoiceId: string, draft: BuyerPaymentDraft) => void');
    expect(invoiceDetailView).toContain('onCreateVarianceHandling: (invoiceId: string, draft: BuyerPaymentDraft) => void');
    expect(invoiceDetailView).toContain('创建/更新付款申请');
    expect(invoiceDetailView).toContain('创建/更新差异处理');
    expect(invoiceDetailView).toContain('真实 Java 记录');
  });

  it('updates stage four checklist with the Java UI integration increment', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第四轮');
    expect(checklist).toContain('前端接入付款申请 Java API');
    expect(checklist).toContain('前端接入差异处理 Java API');
    expect(checklist).toContain('scripts/buyer-finance-action-java-integration-ui.test.ts');
  });
});
