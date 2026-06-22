import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive readonly event guard', () => {
  it('documents and surfaces the archived contract fulfillment event write guard', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('contractEventWriteBoundary');
    expect(app).toContain('已归档合同仅保留审计查看，不再写入新的履约事件');
    expect(app).toContain('归档只读写入边界');

    expect(checklist).toContain('| 24 | 合同归档只读事件写入边界 |');
    expect(walkthrough).toContain('合同归档只读事件写入边界');
  });
});
