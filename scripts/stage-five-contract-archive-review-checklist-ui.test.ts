import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review checklist', () => {
  it('renders a readonly archive review checklist from existing contract evidence', () => {
    const app = read('App.tsx');
    const buyerUi = read('data/buyerAdminUi.ts');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(buyerUi).toContain('ContractArchiveReviewChecklistRow');
    expect(buyerUi).toContain('buildContractArchiveReviewChecklistRows');
    expect(buyerUi).toContain('archiveReviewChecklistRows');
    expect(buyerUi).toContain('archiveReviewConclusion');

    expect(app).toContain('合同归档复核清单');
    expect(app).toContain('复核结论');
    expect(app).toContain('审批追溯');
    expect(app).toContain('附件凭证');
    expect(app).toContain('履约事件');
    expect(app).toContain('付款计划');
    expect(app).toContain('审计日志');
    expect(app).toContain('只读复核清单');

    expect(checklist).toContain('| 30 | 合同归档复核清单可视化 |');
    expect(walkthrough).toContain('合同归档复核清单可视化');
  });
});
