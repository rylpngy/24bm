import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review operation trace locator', () => {
  it('links archive review operation traces back to the evidence target section', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('archiveReviewOperationTraceTargetSection');
    expect(app).toContain('定位轨迹证据');
    expect(app).toContain('轨迹定位目标');
    expect(app).toContain('setFocusedArchiveReviewTarget(trace.targetSection)');
    expect(app).toContain("setArchiveReviewFilter('gaps')");

    expect(checklist).toContain('| 41 | 合同归档复核操作轨迹定位联动 |');
    expect(walkthrough).toContain('合同归档复核操作轨迹定位联动');
  });
});
