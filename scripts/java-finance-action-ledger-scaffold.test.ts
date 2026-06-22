import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java finance action ledger scaffold', () => {
  it('adds backend tables and buyer APIs for payment requests and variance handling records', () => {
    expect(existsSync('backend-java/src/main/resources/db/migration/V102__finance_action_ledgers.sql')).toBe(true);
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/api/BuyerFinanceActionController.java')).toBe(true);
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java')).toBe(true);
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/infrastructure/PaymentRequestMapper.java')).toBe(true);
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/infrastructure/VarianceHandlingMapper.java')).toBe(true);

    const migration = read('backend-java/src/main/resources/db/migration/V102__finance_action_ledgers.sql');
    const controller = read('backend-java/src/main/java/com/procurement/finance/api/BuyerFinanceActionController.java');
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');

    expect(migration).toContain('create table payment_requests');
    expect(migration).toContain('create table variance_handlings');
    expect(migration).toContain('unique (tenant_id, invoice_id)');
    expect(controller).toContain('@RequestMapping("/api/v1/buyer")');
    expect(controller).toContain('@GetMapping("/payment-requests")');
    expect(controller).toContain('@PostMapping("/payment-requests")');
    expect(controller).toContain('@GetMapping("/variance-handlings")');
    expect(controller).toContain('@PostMapping("/variance-handlings")');
    expect(service).toContain('TenantFeatureKey.FINANCE');
    expect(service).toContain('TenantAccessGuard.requireTenantId');
    expect(service).toContain('invoiceMapper.findByTenantAndId');
  });

  it('adds frontend Java client methods for the new finance action ledgers', () => {
    const client = read('services/procurementApiClient.ts');

    expect(client).toContain('PaymentRequestRecord');
    expect(client).toContain('VarianceHandlingRecord');
    expect(client).toContain('listBuyerPaymentRequests');
    expect(client).toContain('createBuyerPaymentRequest');
    expect(client).toContain('listBuyerVarianceHandlings');
    expect(client).toContain('createBuyerVarianceHandling');
    expect(client).toContain('/api/v1/buyer/payment-requests');
    expect(client).toContain('/api/v1/buyer/variance-handlings');
  });

  it('documents the third stage-four finance increment', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第三轮');
    expect(checklist).toContain('付款申请 Java API');
    expect(checklist).toContain('差异处理 Java API');
    expect(checklist).toContain('scripts/java-finance-action-ledger-scaffold.test.ts');
  });
});
