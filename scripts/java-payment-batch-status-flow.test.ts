import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java payment batch status flow', () => {
  it('adds a buyer API for payment batch level status updates', () => {
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/api/UpdatePaymentBatchStatusRequest.java')).toBe(true);

    const controller = read('backend-java/src/main/java/com/procurement/finance/api/BuyerFinanceActionController.java');
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const mapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/PaymentBatchMapper.java');
    const security = read('backend-java/src/test/java/com/procurement/HttpSecurityContractTests.java');

    expect(controller).toContain('@PutMapping("/payment-batches/{paymentBatchNo}/status")');
    expect(controller).toContain('UpdatePaymentBatchStatusRequest');
    expect(service).toContain('updateCurrentTenantPaymentBatchStatus');
    expect(service).toContain('payment_batch.submitted');
    expect(service).toContain('payment_batch.approved');
    expect(mapper).toContain('findByTenantAndPaymentBatchNo');
    expect(mapper).toContain('updateStatus');
    expect(security).toContain('put("/api/v1/buyer/payment-batches/PAY-DEMO/status")');
  });

  it('adds frontend Java client support for payment batch status updates', () => {
    const client = read('services/procurementApiClient.ts');
    const contract = read('data/apiContract.ts');

    expect(client).toContain('UpdatePaymentBatchStatusPayload');
    expect(client).toContain('updateBuyerPaymentBatchStatus');
    expect(client).toContain('/api/v1/buyer/payment-batches/${encodeURIComponent(paymentBatchNo)}/status');
    expect(contract).toContain("path: '/buyer/payment-batches/{paymentBatchNo}/status'");
    expect(contract).toContain('采购方推进付款批次审批和执行准备状态');
  });
});
