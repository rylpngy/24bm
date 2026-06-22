import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five entry decision', () => {
  it('documents the stage-five entry decision and prioritizes contract management MVP', () => {
    const docPath = 'docs/stage-five-entry-decision.md';

    expect(existsSync(docPath)).toBe(true);

    const doc = read(docPath);
    expect(doc).toContain('# 阶段五入口决策');
    expect(doc).toContain('阶段四财务最终收口包');
    expect(doc).toContain('推荐方向：合同管理 MVP');
    expect(doc).toContain('备选方向：供应商绩效基础评分');
    expect(doc).toContain('暂不优先：真实支付前置设计');
    expect(doc).toContain('不接真实支付、银企直连、批量付款执行、税控开票或银行回单');
    expect(doc).toContain('合同台账');
    expect(doc).toContain('合同审批');
    expect(doc).toContain('合同履约跟踪');
    expect(doc).toContain('合同归档');
    expect(doc).toContain('供应商绩效基础评分');
    expect(doc).toContain('先不进入商城、竞价、招标和 AI');
  });

  it('records stage-five execution scope, first round, and acceptance commands', () => {
    const doc = read('docs/stage-five-entry-decision.md');
    const checklistPath = 'docs/stage-five-execution-checklist.md';

    expect(existsSync(checklistPath)).toBe(true);

    const checklist = read(checklistPath);
    expect(doc).toContain('第一轮建议');
    expect(doc).toContain('合同管理 MVP 信息架构');
    expect(doc).toContain('docs/stage-five-contract-information-architecture.md');
    expect(doc).toContain('采购订单 → 合同草案 → 合同审批 → 合同生效 → 履约跟踪 → 合同归档');
    expect(doc).toContain('npm test -- scripts/stage-five-entry-decision.test.ts');
    expect(doc).toContain('npm test');
    expect(doc).toContain('git diff --check');

    expect(checklist).toContain('# 阶段五执行清单');
    expect(checklist).toContain('| 1 | 阶段五入口决策 |');
    expect(checklist).toContain('第1轮已完成阶段五入口决策');
    expect(checklist).toContain('docs/stage-five-entry-decision.md');
    expect(checklist).toContain('scripts/stage-five-entry-decision.test.ts');
  });
});
