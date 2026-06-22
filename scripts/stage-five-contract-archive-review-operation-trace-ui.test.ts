import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review operation trace', () => {
  it('shows a read-only archive review operation trace for page-level confirmations', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('archiveReviewOperationTraceRows');
    expect(app).toContain('归档复核操作轨迹');
    expect(app).toContain('轨迹来源入口');
    expect(app).toContain('复核缺口');
    expect(app).toContain('确认状态');
    expect(app).toContain('页面内轨迹');

    expect(checklist).toContain('| 40 | 合同归档复核操作轨迹 |');
    expect(walkthrough).toContain('合同归档复核操作轨迹');
  });
});
