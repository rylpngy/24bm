import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review result loop', () => {
  it('reviews archive review suggestion handling results back in contract detail', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('archiveReviewResultGapItem');
    expect(app).toContain('archiveReviewResultEvidenceStatus');
    expect(app).toContain('archiveReviewResultNextStep');
    expect(app).toContain('归档复核处理回看');
    expect(app).toContain('缺口处理结果');
    expect(app).toContain('新增证据状态');
    expect(app).toContain('后续复核动作');

    expect(checklist).toContain('| 36 | 合同归档复核处理结果回看 |');
    expect(walkthrough).toContain('合同归档复核处理结果回看');
  });
});
