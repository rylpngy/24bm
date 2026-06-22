import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage ten contract presenter runbook', () => {
  it('documents a contract-specific presenter script with evidence and checks', () => {
    const path = 'docs/stage-ten-contract-presenter-runbook.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十合同现场演示讲解稿');
    expect(doc).toContain('## 演示前检查');
    expect(doc).toContain('http://localhost:3000/?role=buyer&module=contracts');
    expect(doc).toContain('http://localhost:8080/api/v1/health');
    expect(doc).toContain('node scripts/stage-ten-contract-demo-path-check.mjs');
    expect(doc).toContain('node scripts/stage-seven-onsite-demo-acceptance-check.mjs');
    expect(doc).toContain('docs/artifacts/stage-ten-contract-demo-path-result.json');
    expect(doc).toContain('docs/stage-ten-contract-demo-path-review.md');
    expect(doc).toContain('无加载失败');
    expect(doc).toContain('无 `argument type mismatch`');
    expect(doc).toContain('无 React runtime error');
  });

  it('covers the five-page contract order handoff flow and contract page highlights', () => {
    const doc = read('docs/stage-ten-contract-presenter-runbook.md');

    expect(doc).toContain('## 演示顺序');
    expect(doc).toContain('采购订单');
    expect(doc).toContain('合同管理');
    expect(doc).toContain('审批中心');
    expect(doc).toContain('收货验收');
    expect(doc).toContain('发票付款');
    expect(doc).toContain('阶段十合同演示总线');
    expect(doc).toContain('推荐合同样本');
    expect(doc).toContain('合同演示动作闭环');
    expect(doc).toContain('订单生成合同');
    expect(doc).toContain('合同审批');
    expect(doc).toContain('合同履约事件');
    expect(doc).toContain('合同与订单/发票/付款关系');
  });

  it('keeps product-demo boundaries explicit and records the fifth stage-ten increment', () => {
    const doc = read('docs/stage-ten-contract-presenter-runbook.md');
    const checklist = read('docs/stage-ten-execution-checklist.md');

    expect(doc).toContain('## 暂不声明');
    expect(doc).toContain('不声明电子签章');
    expect(doc).toContain('不声明真实支付');
    expect(doc).toContain('不声明完整法务合同生命周期');
    expect(doc).toContain('不声明外部合同系统集成');

    expect(checklist).toContain('| 5 | 合同现场讲解脚本和 Java 视觉复跑 |');
    expect(checklist).toContain('docs/stage-ten-contract-presenter-runbook.md');
    expect(checklist).toContain('stage-ten-contract-demo-path-result.json');
    expect(checklist).toContain('阶段十合同页新增演示总线、推荐样本和动作闭环');
    expect(checklist).toContain('| 6 | 阶段十合同演示收口复盘 |');
    expect(checklist).toContain('下一轮建议：回到采购主流程 polish');
  });
});
