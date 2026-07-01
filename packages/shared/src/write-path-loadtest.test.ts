import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('write-path load test handoff', () => {
  it('documents and exposes the Java write-path load test script', () => {
    const script = read('scripts/loadtest-write-paths.mjs');
    const pkg = read('package.json');
    const readiness = read('docs/production-readiness.md');

    expect(pkg).toContain('"loadtest:write": "node scripts/loadtest-write-paths.mjs"');
    expect(readiness).toContain('scripts/loadtest-write-paths.mjs');
    expect(script).toContain('/api/v1/buyer/demands');
    expect(script).toContain('/api/v1/buyer/rfqs');
    expect(script).toContain('/api/v1/supplier/rfqs/${rfq.id}/quotes');
    expect(script).toContain('/api/v1/supplier/orders/${order.id}/deliveries');
    expect(script).toContain('/api/v1/buyer/payment-requests');
    expect(script).toContain('WRITE_PATHS');
  });
});
