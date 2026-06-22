import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java three-way match ledger scaffold', () => {
  it('adds a tenant-scoped backend ledger and buyer API for three-way match snapshots', () => {
    expect(existsSync('backend-java/src/main/resources/db/migration/V105__three_way_matches.sql')).toBe(true);
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/domain/ThreeWayMatch.java')).toBe(true);
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/api/ThreeWayMatchResponse.java')).toBe(true);
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/infrastructure/ThreeWayMatchMapper.java')).toBe(true);

    const migration = read('backend-java/src/main/resources/db/migration/V105__three_way_matches.sql');
    const controller = read('backend-java/src/main/java/com/procurement/finance/api/BuyerFinanceActionController.java');
    const invoiceService = read('backend-java/src/main/java/com/procurement/finance/application/InvoiceApplicationService.java');
    const paymentService = read('backend-java/src/main/java/com/procurement/finance/application/PaymentApplicationService.java');
    const mapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/ThreeWayMatchMapper.java');

    expect(migration).toContain('create table three_way_matches');
    expect(migration).toContain('unique (tenant_id, invoice_id)');
    expect(migration).toContain('create index idx_three_way_matches_tenant_status');
    expect(controller).toContain('@GetMapping("/three-way-matches")');
    expect(invoiceService).toContain('threeWayMatchMapper.upsertFromInvoice');
    expect(paymentService).toContain('threeWayMatchMapper.upsertFromInvoice');
    expect(mapper).toContain('listByTenantFiltered');
    expect(mapper).toContain('upsertFromInvoice');
    expect(mapper).toContain('payment_readiness');
  });

  it('adds frontend Java client support for buyer three-way matches', () => {
    const client = read('services/procurementApiClient.ts');

    expect(client).toContain('ThreeWayMatchRecord');
    expect(client).toContain('ListBuyerThreeWayMatchesParams');
    expect(client).toContain('listBuyerThreeWayMatches');
    expect(client).toContain('/api/v1/buyer/three-way-matches');
    expect(client).toContain('threeWayMatches?: ThreeWayMatchRecord[]');
    expect(client).toContain('client.listBuyerThreeWayMatches().catch(() => [])');
  });

  it('documents the eleventh stage-four finance increment and API contract boundary', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');
    const contract = read('data/apiContract.ts');

    expect(checklist).toContain('第十一轮');
    expect(checklist).toContain('三单匹配后端留痕');
    expect(checklist).toContain('scripts/java-three-way-match-scaffold.test.ts');
    expect(contract).toContain("path: '/buyer/three-way-matches'");
    expect(contract).toContain("queryParameters: ['matchStatus', 'supplierId', 'orderId', 'invoiceId']");
  });
});
