import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review new evidence status', () => {
  it('marks matching archive review checklist items as pending new evidence review', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('archiveReviewNewEvidenceItem');
    expect(app).toContain('archiveReviewNewEvidenceStatus');
    expect(app).toContain('archiveReviewNewEvidenceNextStep');
    expect(app).toContain('待复核新证据');
    expect(app).toContain('新证据待复核');
    expect(app).toContain('处理回看摘要');

    expect(checklist).toContain('| 37 | 合同归档复核清单新证据状态 |');
    expect(walkthrough).toContain('合同归档复核清单新证据状态');
  });
});
