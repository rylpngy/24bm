import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java three-way match smoke coverage', () => {
  it('checks the RFQ-to-payment smoke path against buyer three-way match snapshots', () => {
    const smoke = read('scripts/java-local-smoke.mjs');
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(smoke).toContain('/api/v1/buyer/three-way-matches');
    expect(smoke).toContain('matchStatus=');
    expect(smoke).toContain('三单匹配通过');
    expect(smoke).toContain('paymentReadiness');
    expect(checklist).toContain('三单匹配 smoke');
    expect(checklist).toContain('scripts/java-three-way-match-smoke.test.ts');
  });
});
