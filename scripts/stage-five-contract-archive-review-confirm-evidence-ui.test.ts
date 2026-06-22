import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review confirmed evidence', () => {
  it('allows pending new evidence to be confirmed as covered in the archive checklist', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('archiveReviewConfirmedEvidenceItem');
    expect(app).toContain('confirmArchiveReviewNewEvidence');
    expect(app).toContain('标记为已复核');
    expect(app).toContain('已确认覆盖');
    expect(app).toContain('复核确认结果');
    expect(app).toContain('页面内确认');

    expect(checklist).toContain('| 38 | 合同归档复核新证据确认动作 |');
    expect(walkthrough).toContain('合同归档复核新证据确认动作');
  });
});
