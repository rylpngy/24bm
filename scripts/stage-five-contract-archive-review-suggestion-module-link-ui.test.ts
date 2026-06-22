import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review suggestion module link', () => {
  it('links archive review suggestions to the existing buyer target modules', () => {
    const app = read('App.tsx');
    const buyerUi = read('data/buyerAdminUi.ts');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(buyerUi).toContain('targetModuleId');
    expect(buyerUi).toContain("targetModuleId: 'approvals'");
    expect(buyerUi).toContain("targetModuleId: 'contracts'");
    expect(buyerUi).toContain("targetModuleId: 'receipts'");
    expect(buyerUi).toContain("targetModuleId: 'invoices'");
    expect(buyerUi).toContain("targetModuleId: 'audit'");

    expect(app).toContain('handleArchiveReviewSuggestionModuleLink');
    expect(app).toContain('去处理模块');
    expect(app).toContain('suggestion.targetModuleId');
    expect(app).toContain('setArchiveReviewFilter');
    expect(app).toContain('onNavigateBuyerModule?.(suggestion.targetModuleId)');
    expect(app).toContain('处理建议联动');

    expect(checklist).toContain('| 34 | 合同归档复核建议快捷处理联动 |');
    expect(walkthrough).toContain('合同归档复核建议快捷处理联动');
  });
});
