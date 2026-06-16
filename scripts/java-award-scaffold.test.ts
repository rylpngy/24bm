import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java RFQ award scaffold', () => {
  it('exposes buyer RFQ award endpoint', () => {
    const controller = read('backend-java/src/main/java/com/procurement/sourcing/api/RfqAwardController.java');

    expect(controller).toContain('@RequestMapping("/api/v1/buyer/rfqs")');
    expect(controller).toContain('@PostMapping("/{rfqId}/award")');
    expect(controller).toContain('AwardRfqRequest');
  });

  it('defines request and response DTOs for award decisions', () => {
    const request = read('backend-java/src/main/java/com/procurement/sourcing/api/AwardRfqRequest.java');
    const response = read('backend-java/src/main/java/com/procurement/sourcing/api/AwardDecisionResponse.java');

    expect(request).toContain('quoteId');
    expect(request).toContain('reason');
    expect(response).toContain('tenantId');
    expect(response).toContain('supplierId');
    expect(response).toContain('amount');
    expect(response).toContain('approvedStatus');
  });

  it('uses a MyBatis mapper for award_decisions table operations', () => {
    const awardMapper = read('backend-java/src/main/java/com/procurement/sourcing/infrastructure/AwardDecisionMapper.java');

    expect(awardMapper).toContain('@Mapper');
    expect(awardMapper).toContain('award_decisions');
    expect(awardMapper).toContain('approved_status');
    expect(awardMapper).toContain('insert');
  });

  it('extends RFQ and quote mappers for award validation and RFQ status update', () => {
    const rfqMapper = read('backend-java/src/main/java/com/procurement/sourcing/infrastructure/RfqMapper.java');
    const quoteMapper = read('backend-java/src/main/java/com/procurement/sourcing/infrastructure/QuoteMapper.java');

    expect(rfqMapper).toContain('updateAward');
    expect(rfqMapper).toContain('awarded_supplier_id');
    expect(quoteMapper).toContain('findSubmittedQuoteForAward');
    expect(quoteMapper).toContain('status = #{status}');
  });

  it('keeps award creation isolated to buyer tenant and submitted quote rules', () => {
    const service = read('backend-java/src/main/java/com/procurement/sourcing/application/AwardApplicationService.java');

    expect(service).toContain('TenantAccessGuard.requireTenantId');
    expect(service).toContain('QuoteStatus.SUBMITTED');
    expect(service).toContain('RfqAwardStatusTransition');
    expect(service).toContain('requireAwardSubmission');
    expect(service).toContain('reviewTargetStatus');
    expect(service).toContain('ApprovalStatus.APPROVED');
    expect(service).toContain('findSubmittedQuoteForAward');
    expect(service).toContain('updateAward');
    const transition = read('backend-java/src/main/java/com/procurement/sourcing/domain/RfqAwardStatusTransition.java');
    expect(transition).toContain('RfqStatus.AWARDED');
  });

  it('documents the award Java API handoff', () => {
    const readme = read('backend-java/README.md');
    const architecture = read('docs/java-backend-architecture.md');

    expect(readme).toContain('POST /api/v1/buyer/rfqs/{rfqId}/award');
    expect(architecture).toContain('比价定标 Java API');
  });
});
