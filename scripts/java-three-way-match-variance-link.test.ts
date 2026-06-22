import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java three-way match variance handling link', () => {
  it('adds a buyer API that creates or reuses variance handling from an abnormal match', () => {
    const controller = read('backend-java/src/main/java/com/procurement/finance/api/BuyerFinanceActionController.java');
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const mapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/ThreeWayMatchMapper.java');

    expect(controller).toContain('@PostMapping("/three-way-matches/{matchId}/variance-handling")');
    expect(service).toContain('createVarianceHandlingFromThreeWayMatch');
    expect(service).toContain('threeWayMatchMapper.findByTenantAndId');
    expect(service).toContain('"金额差异".equals(match.matchStatus())');
    expect(service).toContain('varianceHandlingMapper.upsert');
    expect(service).toContain('varianceHandlingMapper.findByTenantAndInvoice');
    expect(mapper).toContain('findByTenantAndId');
  });

  it('adds frontend client support for creating variance handling from a three-way match', () => {
    const client = read('services/procurementApiClient.ts');

    expect(client).toContain('createBuyerVarianceHandlingFromThreeWayMatch');
    expect(client).toContain('/api/v1/buyer/three-way-matches/${matchId}/variance-handling');
    expect(client).toContain('Promise<VarianceHandlingRecord>');
  });

  it('documents the abnormal match handoff in the stage-four checklist and API contract', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');
    const contract = read('data/apiContract.ts');

    expect(checklist).toContain('三单异常联动差异处理');
    expect(checklist).toContain('scripts/java-three-way-match-variance-link.test.ts');
    expect(contract).toContain("path: '/buyer/three-way-matches/{matchId}/variance-handling'");
    expect(contract).toContain('CreateVarianceHandlingFromThreeWayMatchRequest');
  });
});
