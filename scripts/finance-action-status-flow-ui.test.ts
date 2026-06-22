import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('finance action status flow', () => {
  it('adds Java status update contracts for payment requests and variance handlings', () => {
    const client = read('services/procurementApiClient.ts');
    const controller = read('backend-java/src/main/java/com/procurement/finance/api/BuyerFinanceActionController.java');
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const paymentMapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/PaymentRequestMapper.java');
    const varianceMapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/VarianceHandlingMapper.java');

    expect(existsSync('backend-java/src/main/java/com/procurement/finance/api/UpdatePaymentRequestStatusRequest.java')).toBe(true);
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/api/UpdateVarianceHandlingStatusRequest.java')).toBe(true);
    expect(controller).toContain('@PutMapping("/payment-requests/{paymentRequestId}/status")');
    expect(controller).toContain('@PutMapping("/variance-handlings/{varianceHandlingId}/status")');
    expect(service).toContain('updateCurrentTenantPaymentRequestStatus');
    expect(service).toContain('updateCurrentTenantVarianceHandlingStatus');
    expect(paymentMapper).toContain('updateStatus');
    expect(varianceMapper).toContain('updateStatus');
    expect(client).toContain('UpdatePaymentRequestStatusPayload');
    expect(client).toContain('updateBuyerPaymentRequestStatus');
    expect(client).toContain('UpdateVarianceHandlingStatusPayload');
    expect(client).toContain('updateBuyerVarianceHandlingStatus');
    expect(client).toContain('/api/v1/buyer/payment-requests/${paymentRequestId}/status');
    expect(client).toContain('/api/v1/buyer/variance-handlings/${varianceHandlingId}/status');
  });

  it('surfaces approval and variance status actions in the buyer invoice detail', () => {
    const app = read('App.tsx');
    const invoiceDetailView = app.slice(
      app.indexOf('const InvoicePaymentDetailPanelView'),
      app.indexOf('const InvoicePaymentOperationPanel'),
    );
    const buyerWorkspaceType = app.slice(
      app.indexOf('const BuyerWorkspaceView: React.FC<{'),
      app.indexOf('}> = ({', app.indexOf('const BuyerWorkspaceView: React.FC<{')),
    );

    expect(app).toContain('updateBuyerPaymentRequestStatus');
    expect(app).toContain('updateBuyerVarianceHandlingStatus');
    expect(app).toContain('javaApiClient.updateBuyerPaymentRequestStatus');
    expect(app).toContain('javaApiClient.updateBuyerVarianceHandlingStatus');
    expect(buyerWorkspaceType).toContain('onUpdatePaymentRequestStatus');
    expect(buyerWorkspaceType).toContain('onUpdateVarianceHandlingStatus');
    expect(invoiceDetailView).toContain('onUpdatePaymentRequestStatus: (paymentRequestId: string, status: string) => void');
    expect(invoiceDetailView).toContain('onUpdateVarianceHandlingStatus: (varianceHandlingId: string, status: string) => void');
    expect(invoiceDetailView).toContain('提交付款审批');
    expect(invoiceDetailView).toContain('通过付款申请');
    expect(invoiceDetailView).toContain('标记差异已处理');
    expect(invoiceDetailView).toContain('付款申请状态流转');
    expect(invoiceDetailView).toContain('差异处理状态流转');
  });

  it('records the fifth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第五轮');
    expect(checklist).toContain('付款申请状态流转');
    expect(checklist).toContain('差异处理状态流转');
    expect(checklist).toContain('scripts/finance-action-status-flow-ui.test.ts');
  });
});
