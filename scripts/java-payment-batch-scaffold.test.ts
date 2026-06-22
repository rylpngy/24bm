import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java payment batch scaffold', () => {
  it('adds a tenant-scoped Java payment batch ledger API', () => {
    expect(existsSync('backend-java/src/main/resources/db/migration/V104__payment_batches.sql')).toBe(true);
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/domain/PaymentBatch.java')).toBe(true);
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/api/PaymentBatchResponse.java')).toBe(true);
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/infrastructure/PaymentBatchMapper.java')).toBe(true);

    const migration = read('backend-java/src/main/resources/db/migration/V104__payment_batches.sql');
    const controller = read('backend-java/src/main/java/com/procurement/finance/api/BuyerFinanceActionController.java');
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const mapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/PaymentBatchMapper.java');

    expect(migration).toContain('create table payment_batches');
    expect(migration).toContain('unique (tenant_id, payment_batch_no)');
    expect(migration).toContain('create index idx_payment_batches_tenant_status');
    expect(controller).toContain('@GetMapping("/payment-batches")');
    expect(service).toContain('listCurrentTenantPaymentBatches');
    expect(service).toContain('syncPaymentBatch');
    expect(mapper).toContain('listByTenantFiltered');
    expect(mapper).toContain('upsertFromPaymentRequests');
  });

  it('adds frontend Java client support for buyer payment batches', () => {
    const client = read('services/procurementApiClient.ts');

    expect(client).toContain('PaymentBatchRecord');
    expect(client).toContain('ListBuyerPaymentBatchesParams');
    expect(client).toContain('listBuyerPaymentBatches');
    expect(client).toContain('/api/v1/buyer/payment-batches');
    expect(client).toContain('paymentBatches?: PaymentBatchRecord[]');
    expect(client).toContain('client.listBuyerPaymentBatches().catch(() => [])');
  });

  it('documents the eighth stage-four finance increment and keeps the payment boundary explicit', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');
    const contract = read('data/apiContract.ts');

    expect(checklist).toContain('第八轮');
    expect(checklist).toContain('付款批次 Java API');
    expect(checklist).toContain('scripts/java-payment-batch-scaffold.test.ts');
    expect(checklist).toContain('尚未接真实支付、批量付款执行和银企直连');
    expect(contract).toContain("path: '/buyer/payment-batches'");
    expect(contract).toContain("queryParameters: ['batchStatus', 'supplierId']");
  });
});
