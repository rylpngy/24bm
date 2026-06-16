import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java supplier quote scaffold', () => {
  it('exposes supplier quote submission endpoint', () => {
    const controller = read('backend-java/src/main/java/com/procurement/sourcing/api/SupplierQuoteController.java');

    expect(controller).toContain('@RequestMapping("/api/v1/supplier/rfqs")');
    expect(controller).toContain('@PostMapping("/{rfqId}/quotes")');
    expect(controller).toContain('SubmitQuoteRequest');
  });

  it('defines request and response DTOs for quote submission', () => {
    const request = read('backend-java/src/main/java/com/procurement/sourcing/api/SubmitQuoteRequest.java');
    const response = read('backend-java/src/main/java/com/procurement/sourcing/api/QuoteResponse.java');

    expect(request).toContain('amount');
    expect(request).toContain('taxRate');
    expect(request).toContain('deliveryDays');
    expect(response).toContain('tenantId');
    expect(response).toContain('supplierId');
    expect(response).toContain('status');
    expect(response).toContain('submittedAt');
  });

  it('uses a MyBatis mapper for quotes table operations', () => {
    const quoteMapper = read('backend-java/src/main/java/com/procurement/sourcing/infrastructure/QuoteMapper.java');

    expect(quoteMapper).toContain('@Mapper');
    expect(quoteMapper).toContain('quotes');
    expect(quoteMapper).toContain('countSubmittedBySupplier');
    expect(quoteMapper).toContain('insert');
  });

  it('checks supplier context, RFQ status, invitation, and duplicate quote rules', () => {
    const service = read('backend-java/src/main/java/com/procurement/sourcing/application/QuoteApplicationService.java');

    expect(service).toContain('TenantAccessGuard.requireSupplierId');
    expect(service).toContain('RfqStatus.QUOTING');
    expect(service).toContain('已提交');
    expect(service).toContain('isSupplierInvited');
    expect(service).toContain('countSubmittedBySupplier');
  });

  it('extends RFQ invite mapper with supplier invitation lookup', () => {
    const inviteMapper = read('backend-java/src/main/java/com/procurement/sourcing/infrastructure/RfqInviteMapper.java');

    expect(inviteMapper).toContain('isSupplierInvited');
    expect(inviteMapper).toContain('supplier_id = #{supplierId}');
  });

  it('documents the quote Java API handoff', () => {
    const readme = read('backend-java/README.md');
    const architecture = read('docs/java-backend-architecture.md');

    expect(readme).toContain('POST /api/v1/supplier/rfqs/{rfqId}/quotes');
    expect(architecture).toContain('供应商报价 Java API');
  });
});
