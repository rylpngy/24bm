import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review history risk summary', () => {
  it('shows blocking risk and next action for archive review history', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('archiveReviewHistoryRiskSummary');
    expect(app).toContain('归档复核历史风险摘要');
    expect(app).toContain('阻断等级');
    expect(app).toContain('阻断原因');
    expect(app).toContain('风险下一步');
    expect(app).toContain('仍会阻断最终归档');

    expect(checklist).toContain('| 43 | 合同归档复核历史风险摘要 |');
    expect(walkthrough).toContain('合同归档复核历史风险摘要');
  });
});
