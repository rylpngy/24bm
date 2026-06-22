import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java payment block resolution smoke coverage', () => {
  it('creates, updates, lists, and logs a real payment block resolution sample', () => {
    const smoke = read('scripts/java-local-smoke.mjs');

    expect(smoke).toContain('/api/v1/buyer/payment-block-resolutions');
    expect(smoke).toContain('paymentBlockResolution');
    expect(smoke).toContain('Java smoke 阻断处理记录');
    expect(smoke).toContain("resolutionStatus: '处理中'");
    expect(smoke).toContain("resolutionStatus: '已处理待刷新'");
    expect(smoke).toContain('/api/v1/buyer/payment-block-resolutions/${paymentBlockResolution.id}/status');
    expect(smoke).toContain('Loaded payment block resolutions');
    expect(smoke).toContain('Created payment block resolution');
  });

  it('records the fifty eighth stage-four increment in the finance checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');
    const visualDoc = read('docs/stage-four-java-visual-walkthrough-result.md');

    expect(checklist).toContain('| 58 | 付款阻断处理记录非空回显 |');
    expect(checklist).toContain('scripts/java-payment-block-resolution-smoke.test.ts');
    expect(visualDoc).toContain('第58轮');
    expect(visualDoc).toContain('Java smoke 阻断处理记录');
    expect(visualDoc).toContain('非空回显');
  });
});
