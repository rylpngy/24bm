import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage ten contract order handoff plan', () => {
  it('documents stage ten as a contract-order handoff stage that reuses stage-five contract work', () => {
    const path = 'docs/stage-ten-contract-order-handoff-plan.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十计划：合同管理承接订单');
    expect(doc).toContain('## 阶段定位');
    expect(doc).toContain('复用阶段五合同管理能力');
    expect(doc).toContain('阶段九可演示版本');
    expect(doc).toContain('订单生成合同');
    expect(doc).toContain('合同审批');
    expect(doc).toContain('合同履约事件');
    expect(doc).toContain('合同与订单/发票/付款关系');
    expect(doc).toContain('不做电子签章');
    expect(doc).toContain('不接外部合同系统');
  });

  it('defines a first-round MVP, acceptance evidence, and strict deferrals', () => {
    const doc = read('docs/stage-ten-contract-order-handoff-plan.md');

    expect(doc).toContain('## 第一轮 MVP');
    expect(doc).toContain('## 现有证据复用');
    expect(doc).toContain('docs/stage-five-closeout-acceptance-package.md');
    expect(doc).toContain('docs/stage-nine-closeout-decision-review.md');
    expect(doc).toContain('scripts/stage-five-contract-save-actions.test.ts');
    expect(doc).toContain('scripts/stage-five-contract-approval-entry-ui.test.ts');
    expect(doc).toContain('backend-java/src/test/java/com/procurement/ContractSaveActionTests.java');
    expect(doc).toContain('backend-java/src/test/java/com/procurement/ContractApprovalFlowTests.java');
    expect(doc).toContain('## 暂缓范围');
    expect(doc).toContain('商城直采');
    expect(doc).toContain('竞价采购');
    expect(doc).toContain('招标');
    expect(doc).toContain('AI');
  });

  it('records the first stage-ten increment in a dedicated execution checklist', () => {
    const checklist = read('docs/stage-ten-execution-checklist.md');

    expect(checklist).toContain('# 阶段十执行清单');
    expect(checklist).toContain('| 1 | 合同管理承接订单计划 |');
    expect(checklist).toContain('docs/stage-ten-contract-order-handoff-plan.md');
    expect(checklist).toContain('scripts/stage-ten-contract-order-handoff-plan.test.ts');
    expect(checklist).toContain('| 2 | 合同演示路径复核 |');
    expect(checklist).toContain('| 3 | 合同演示总线和推荐样本 |');
    expect(checklist).toContain('| 4 | 合同演示动作闭环 |');
    expect(checklist).toContain('| 5 | 合同现场讲解脚本和 Java 视觉复跑 |');
    expect(checklist).toContain('| 6 | 阶段十合同演示收口复盘 |');
    expect(checklist).toContain('下一轮建议：回到采购主流程 polish');
  });
});
