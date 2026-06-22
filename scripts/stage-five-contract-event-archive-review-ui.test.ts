import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract event archive review UI', () => {
  it('uses persisted fulfillment events as archive review and audit evidence', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('contractEventEvidenceSummary');
    expect(app).toContain('归档复核事件证据');
    expect(app).toContain('事件证据覆盖');
    expect(app).toContain('最近事件证据');
    expect(app).toContain('合同事件审计提示');
    expect(app).toContain('收货事件');
    expect(app).toContain('付款事件');

    expect(checklist).toContain('| 23 | 合同履约事件归档复核联动 |');
    expect(walkthrough).toContain('合同履约事件归档复核联动');
  });
});
