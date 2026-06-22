import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java payment block resolution scaffold', () => {
  it('adds a tenant-scoped payment block resolution ledger in Java', () => {
    expect(existsSync('backend-java/src/main/resources/db/migration/V109__payment_block_resolutions.sql')).toBe(true);

    const migration = read('backend-java/src/main/resources/db/migration/V109__payment_block_resolutions.sql');
    const domain = read('backend-java/src/main/java/com/procurement/finance/domain/PaymentBlockResolution.java');
    const mapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/PaymentBlockResolutionMapper.java');
    const response = read('backend-java/src/main/java/com/procurement/finance/api/PaymentBlockResolutionResponse.java');
    const createRequest = read('backend-java/src/main/java/com/procurement/finance/api/CreatePaymentBlockResolutionRequest.java');
    const updateRequest = read('backend-java/src/main/java/com/procurement/finance/api/UpdatePaymentBlockResolutionStatusRequest.java');
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const controller = read('backend-java/src/main/java/com/procurement/finance/api/BuyerFinanceActionController.java');

    expect(migration).toContain('create table payment_block_resolutions');
    expect(migration).toContain('tenant_id varchar(64) not null');
    expect(migration).toContain('payment_batch_no varchar(64) not null');
    expect(migration).toContain('payment_request_id varchar(64)');
    expect(migration).toContain('invoice_id varchar(64)');
    expect(migration).toContain('block_reason varchar(128) not null');
    expect(migration).toContain('resolution_status varchar(64) not null');
    expect(migration).toContain('unique (tenant_id, payment_batch_no, payment_request_id, block_reason)');

    expect(domain).toContain('record PaymentBlockResolution');
    expect(domain).toContain('String resolutionStatus');
    expect(domain).toContain('String resolutionAction');
    expect(domain).toContain('String nextStep');

    expect(mapper).toContain('listByTenantFiltered');
    expect(mapper).toContain('insert into payment_block_resolutions');
    expect(mapper).toContain('on conflict (tenant_id, payment_batch_no, payment_request_id, block_reason)');
    expect(mapper).toContain('update payment_block_resolutions');

    expect(response).toContain('record PaymentBlockResolutionResponse');
    expect(createRequest).toContain('record CreatePaymentBlockResolutionRequest');
    expect(updateRequest).toContain('record UpdatePaymentBlockResolutionStatusRequest');
    expect(service).toContain('listCurrentTenantPaymentBlockResolutions');
    expect(service).toContain('createCurrentTenantPaymentBlockResolution');
    expect(service).toContain('updateCurrentTenantPaymentBlockResolutionStatus');
    expect(controller).toContain('@GetMapping("/payment-block-resolutions")');
    expect(controller).toContain('@PostMapping("/payment-block-resolutions")');
    expect(controller).toContain('@PutMapping("/payment-block-resolutions/{resolutionId}/status")');
  });

  it('exposes payment block resolutions through the frontend API client contract', () => {
    const client = read('services/procurementApiClient.ts');

    expect(client).toContain('export interface PaymentBlockResolutionRecord');
    expect(client).toContain('paymentBlockResolutions?: PaymentBlockResolutionRecord[]');
    expect(client).toContain('listBuyerPaymentBlockResolutions');
    expect(client).toContain('/api/v1/buyer/payment-block-resolutions');
    expect(client).toContain('createBuyerPaymentBlockResolution');
    expect(client).toContain('updateBuyerPaymentBlockResolutionStatus');
  });

  it('records the fifty first stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第51轮');
    expect(checklist).toContain('付款阻断处理状态 Java 台账');
    expect(checklist).toContain('scripts/java-payment-block-resolution-scaffold.test.ts');
  });
});
