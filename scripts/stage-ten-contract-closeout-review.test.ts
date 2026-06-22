import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage ten contract closeout review', () => {
  it('documents the stage-ten contract closeout decision with evidence', () => {
    const path = 'docs/stage-ten-contract-closeout-review.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十合同演示收口复盘');
    expect(doc).toContain('## 收口结论');
    expect(doc).toContain('阶段十合同承接订单已达到产品演示阶段目标');
    expect(doc).toContain('## 证据清单');
    expect(doc).toContain('docs/stage-ten-contract-order-handoff-plan.md');
    expect(doc).toContain('docs/stage-ten-contract-demo-path-review.md');
    expect(doc).toContain('docs/stage-ten-contract-presenter-runbook.md');
    expect(doc).toContain('docs/artifacts/stage-ten-contract-demo-path-result.json');
    expect(doc).toContain('node scripts/stage-seven-onsite-demo-acceptance-check.mjs');
    expect(doc).toContain('17 个真实动作');
  });

  it('reviews the contract demo acceptance dimensions and remaining boundaries', () => {
    const doc = read('docs/stage-ten-contract-closeout-review.md');

    expect(doc).toContain('## 演示能力矩阵');
    expect(doc).toContain('订单生成合同');
    expect(doc).toContain('合同审批');
    expect(doc).toContain('合同履约事件');
    expect(doc).toContain('合同与订单/发票/付款关系');
    expect(doc).toContain('阶段十合同演示总线');
    expect(doc).toContain('推荐合同样本');
    expect(doc).toContain('合同演示动作闭环');
    expect(doc).toContain('## 仍不声明');
    expect(doc).toContain('电子签章');
    expect(doc).toContain('真实支付');
    expect(doc).toContain('完整法务合同生命周期');
    expect(doc).toContain('外部合同系统集成');
  });

  it('recommends returning to buyer main-flow polish before legal deepening and records the sixth increment', () => {
    const doc = read('docs/stage-ten-contract-closeout-review.md');
    const checklist = read('docs/stage-ten-execution-checklist.md');

    expect(doc).toContain('## 下一步建议');
    expect(doc).toContain('建议先回到采购主流程 polish');
    expect(doc).toContain('合同法务深化暂缓');
    expect(doc).toContain('不建议立刻进入电子签章或外部合同系统');

    expect(checklist).toContain('| 6 | 阶段十合同演示收口复盘 |');
    expect(checklist).toContain('docs/stage-ten-contract-closeout-review.md');
    expect(checklist).toContain('阶段十合同承接订单已达到产品演示阶段目标');
    expect(checklist).toContain('下一轮建议：回到采购主流程 polish');
  });
});
