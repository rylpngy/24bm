import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review risk resolution entry', () => {
  it('connects archive review risk summary to blocking gap resolution actions', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('archiveReviewRiskResolutionSuggestion');
    expect(app).toContain('解除阻断动作入口');
    expect(app).toContain('解除阻断建议');
    expect(app).toContain('定位阻断缺口');
    expect(app).toContain('去解除阻断');
    expect(app).toContain('handleArchiveReviewSuggestionModuleLink(archiveReviewRiskResolutionSuggestion)');

    expect(checklist).toContain('| 44 | 合同归档复核风险解除入口 |');
    expect(walkthrough).toContain('合同归档复核风险解除入口');
  });
});
