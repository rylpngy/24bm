import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java three-way match variance smoke coverage', () => {
  it('covers the abnormal variance blocking and restoration flow in local smoke', () => {
    const smoke = read('scripts/java-local-smoke.mjs');
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');
    const localDoc = read('docs/local-java-integration.md');

    expect(smoke).toContain('runLocalSmokeSql');
    expect(smoke).toContain('resolveLocalSmokeSqlCommand');
    expect(smoke).toContain('docker');
    expect(smoke).toContain('procurement-saas-postgres');
    expect(smoke).toContain('Java smoke deliberately perturbs invoice amount');
    expect(smoke).toContain("matchStatus=${encodeURIComponent('金额差异')}");
    expect(smoke).toContain('/api/v1/buyer/three-way-matches/${varianceMatch.id}/variance-handling');
    expect(smoke).toContain('/api/v1/buyer/variance-handlings/${varianceHandling.id}/status');
    expect(smoke).toContain("requestStatus: '付款申请待提交'");
    expect(smoke).toContain('Java payment request was not blocked before variance handling');
    expect(smoke).toContain('Recovered payment request');
    expect(checklist).toContain('三单差异阻断恢复 smoke');
    expect(checklist).toContain('scripts/java-three-way-match-variance-smoke.test.ts');
    expect(localDoc).toContain('三单差异阻断恢复 smoke');
  });
});
