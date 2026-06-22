import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java three-way match rebuild flow', () => {
  it('adds a buyer API to rebuild current-tenant three-way match snapshots', () => {
    expect(existsSync('backend-java/src/main/java/com/procurement/finance/api/ThreeWayMatchRebuildResponse.java')).toBe(true);

    const controller = read('backend-java/src/main/java/com/procurement/finance/api/BuyerFinanceActionController.java');
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const mapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/ThreeWayMatchMapper.java');

    expect(controller).toContain('@PostMapping("/three-way-matches/rebuild")');
    expect(service).toContain('rebuildCurrentTenantThreeWayMatches');
    expect(service).toContain('TenantFeatureKey.FINANCE');
    expect(mapper).toContain('rebuildByTenant');
    expect(mapper).toContain('from invoices invoice');
    expect(mapper).toContain('returning id');
  });

  it('adds frontend Java client support for triggering the rebuild', () => {
    const client = read('services/procurementApiClient.ts');

    expect(client).toContain('ThreeWayMatchRebuildResult');
    expect(client).toContain('rebuildBuyerThreeWayMatches');
    expect(client).toContain('/api/v1/buyer/three-way-matches/rebuild');
  });

  it('documents and smokes the historical rebuild boundary', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');
    const contract = read('data/apiContract.ts');
    const smoke = read('scripts/java-local-smoke.mjs');

    expect(checklist).toContain('三单匹配历史回填');
    expect(checklist).toContain('scripts/java-three-way-match-rebuild.test.ts');
    expect(contract).toContain("path: '/buyer/three-way-matches/rebuild'");
    expect(smoke).toContain('/api/v1/buyer/three-way-matches/rebuild');
    expect(smoke).toContain('rebuiltCount');
  });
});
