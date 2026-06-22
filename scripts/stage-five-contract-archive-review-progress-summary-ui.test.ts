import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review progress summary', () => {
  it('summarizes confirmed and pending archive review evidence progress', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('archiveReviewProgressConfirmedCount');
    expect(app).toContain('archiveReviewProgressPendingNewEvidenceCount');
    expect(app).toContain('archiveReviewProgressOpenGapCount');
    expect(app).toContain('归档复核进度摘要');
    expect(app).toContain('本次复核确认');
    expect(app).toContain('待复核新证据');
    expect(app).toContain('待处理缺口');

    expect(checklist).toContain('| 39 | 合同归档复核进度摘要 |');
    expect(walkthrough).toContain('合同归档复核进度摘要');
  });
});
