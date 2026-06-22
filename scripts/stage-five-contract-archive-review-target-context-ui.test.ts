import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review target context', () => {
  it('carries archive review gap context into target module prompts', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('archiveReviewGapItem');
    expect(app).toContain('archiveReviewSuggestedAction');
    expect(app).toContain('archiveReviewHandlingPath');
    expect(app).toContain('navigateBuyerModuleFromArchiveReviewSuggestion');
    expect(app).toContain('归档复核缺口');
    expect(app).toContain('建议处理动作');
    expect(app).toContain('建议处理路径');
    expect(app).toContain('来自归档复核建议');

    expect(checklist).toContain('| 35 | 合同归档复核目标页提示增强 |');
    expect(walkthrough).toContain('合同归档复核目标页提示增强');
  });
});
