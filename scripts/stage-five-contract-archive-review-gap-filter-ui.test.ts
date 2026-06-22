import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review gap filter', () => {
  it('groups archive review checklist rows by gap status for review priority', () => {
    const app = read('App.tsx');
    const buyerUi = read('data/buyerAdminUi.ts');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(buyerUi).toContain('ContractArchiveReviewGroupSummary');
    expect(buyerUi).toContain('buildContractArchiveReviewGroupSummary');
    expect(buyerUi).toContain('archiveReviewGroupSummary');
    expect(buyerUi).toContain('gapCount');
    expect(buyerUi).toContain('coveredCount');

    expect(app).toContain('archiveReviewFilter');
    expect(app).toContain('filteredArchiveReviewChecklistRows');
    expect(app).toContain('复核分组');
    expect(app).toContain('全部复核项');
    expect(app).toContain('优先处理缺口');
    expect(app).toContain('已覆盖证据');
    expect(app).toContain('暂无该分组复核项');

    expect(checklist).toContain('| 32 | 合同归档复核缺口分组筛选 |');
    expect(walkthrough).toContain('合同归档复核缺口分组筛选');
  });
});
