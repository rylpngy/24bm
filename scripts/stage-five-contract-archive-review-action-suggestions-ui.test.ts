import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review action suggestions', () => {
  it('shows suggested actions for archive review gaps without adding backend workflow', () => {
    const app = read('App.tsx');
    const buyerUi = read('data/buyerAdminUi.ts');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(buyerUi).toContain('ContractArchiveReviewActionSuggestion');
    expect(buyerUi).toContain('buildContractArchiveReviewActionSuggestions');
    expect(buyerUi).toContain('archiveReviewActionSuggestions');
    expect(buyerUi).toContain('ownerModule');
    expect(buyerUi).toContain('handlingPath');
    expect(buyerUi).toContain('suggestedAction');

    expect(app).toContain('合同归档复核处理建议');
    expect(app).toContain('建议动作');
    expect(app).toContain('负责模块');
    expect(app).toContain('处理路径');
    expect(app).toContain('暂无缺口处理建议');
    expect(app).toContain('suggestion.archiveReviewTargetSection');

    expect(checklist).toContain('| 33 | 合同归档复核缺口处理建议面板 |');
    expect(walkthrough).toContain('合同归档复核缺口处理建议面板');
  });
});
