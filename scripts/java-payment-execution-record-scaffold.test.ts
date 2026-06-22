import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java payment execution record scaffold', () => {
  it('adds a tenant-scoped Java payment execution record ledger API', () => {
    expect(existsSync('backend-java/src/main/resources/db/migration/V107__payment_execution_records.sql')).toBe(true);
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/domain/PaymentExecutionRecord.java')).toBe(true);
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/api/PaymentExecutionRecordResponse.java')).toBe(true);
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/infrastructure/PaymentExecutionRecordMapper.java')).toBe(true);

    const migration = read('backend-java/src/main/resources/db/migration/V107__payment_execution_records.sql');
    const controller = read('backend-java/src/main/java/com/procurement/finance/api/BuyerFinanceActionController.java');
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const mapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/PaymentExecutionRecordMapper.java');
    const security = read('backend-java/src/test/java/com/procurement/HttpSecurityContractTests.java');

    expect(migration).toContain('create table payment_execution_records');
    expect(migration).toContain('payment_batch_no');
    expect(migration).toContain('payment_request_id');
    expect(migration).toContain('invoice_id');
    expect(migration).toContain('execution_status');
    expect(migration).toContain('registered_amount');
    expect(migration).toContain('execution_trace');
    expect(migration).toContain('unique (tenant_id, payment_request_id)');
    expect(migration).toContain('idx_payment_execution_records_tenant_batch');
    expect(migration).toContain('idx_payment_execution_records_tenant_invoice');
    expect(controller).toContain('@GetMapping("/payment-execution-records")');
    expect(service).toContain('listCurrentTenantPaymentExecutionRecords');
    expect(service).toContain('toPaymentExecutionRecordResponse');
    expect(mapper).toContain('listByTenantFiltered');
    expect(mapper).toContain('upsertFromPaymentRequest');
    expect(mapper).toContain('refreshTenantFromPaymentRequests');
    expect(security).toContain('get("/api/v1/buyer/payment-execution-records")');
  });

  it('adds frontend Java client support for buyer payment execution records', () => {
    const client = read('services/procurementApiClient.ts');

    expect(client).toContain('PaymentExecutionRecord');
    expect(client).toContain('ListBuyerPaymentExecutionRecordsParams');
    expect(client).toContain('listBuyerPaymentExecutionRecords');
    expect(client).toContain('/api/v1/buyer/payment-execution-records');
    expect(client).toContain('paymentExecutionRecords?: PaymentExecutionRecord[]');
    expect(client).toContain('client.listBuyerPaymentExecutionRecords().catch(() => [])');
  });

  it('documents the thirty fifth stage-four finance increment and API contract', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');
    const contract = read('data/apiContract.ts');

    expect(checklist).toContain('第35轮');
    expect(checklist).toContain('付款批次执行记录 Java API');
    expect(checklist).toContain('scripts/java-payment-execution-record-scaffold.test.ts');
    expect(checklist).toContain('不接真实支付');
    expect(contract).toContain("path: '/buyer/payment-execution-records'");
    expect(contract).toContain("queryParameters: ['paymentBatchNo', 'executionStatus', 'supplierId', 'invoiceId']");
  });
});
