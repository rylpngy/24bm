import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract management information architecture', () => {
  it('documents the buyer-side contract management MVP information architecture', () => {
    const docPath = 'docs/stage-five-contract-information-architecture.md';

    expect(existsSync(docPath)).toBe(true);

    const doc = read(docPath);
    expect(doc).toContain('# 阶段五合同管理 MVP 信息架构');
    expect(doc).toContain('采购方菜单入口');
    expect(doc).toContain('合同管理');
    expect(doc).toContain('合同台账');
    expect(doc).toContain('合同详情');
    expect(doc).toContain('合同审批');
    expect(doc).toContain('履约跟踪');
    expect(doc).toContain('合同归档');
    expect(doc).toContain('合同附件');
    expect(doc).toContain('采购订单 → 合同草案 → 合同审批 → 合同生效 → 履约跟踪 → 合同归档');
    expect(doc).toContain('关联采购订单');
    expect(doc).toContain('关联收货验收');
    expect(doc).toContain('关联发票付款');
    expect(doc).toContain('第一轮不新增 Java API');
  });

  it('records data fields, page actions, boundaries, and stage-five checklist entry', () => {
    const doc = read('docs/stage-five-contract-information-architecture.md');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const entryDecision = read('docs/stage-five-entry-decision.md');

    expect(doc).toContain('合同编号');
    expect(doc).toContain('合同名称');
    expect(doc).toContain('供应商');
    expect(doc).toContain('合同金额');
    expect(doc).toContain('合同状态');
    expect(doc).toContain('签订日期');
    expect(doc).toContain('生效日期');
    expect(doc).toContain('到期日期');
    expect(doc).toContain('提交合同审批');
    expect(doc).toContain('审批通过');
    expect(doc).toContain('审批驳回');
    expect(doc).toContain('归档后只读');
    expect(doc).toContain('不做电子签章、法务红线批注、真实付款或外部合同系统集成');
    expect(doc).toContain('npm test -- scripts/stage-five-contract-information-architecture.test.ts');

    expect(checklist).toContain('| 2 | 合同管理 MVP 信息架构 |');
    expect(checklist).toContain('第2轮已完成合同管理 MVP 信息架构');
    expect(checklist).toContain('docs/stage-five-contract-information-architecture.md');
    expect(checklist).toContain('scripts/stage-five-contract-information-architecture.test.ts');
    expect(entryDecision).toContain('docs/stage-five-contract-information-architecture.md');
  });
});
