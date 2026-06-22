import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage nine closeout decision review', () => {
  it('documents stage-nine closeout evidence, gaps, and decision options', () => {
    const path = 'docs/stage-nine-closeout-decision-review.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段九收口复盘与下一阶段实施决策表');
    expect(doc).toContain('## 收口结论');
    expect(doc).toContain('产品可演示优先');
    expect(doc).toContain('17 个真实动作');
    expect(doc).toContain('Java 数据源');
    expect(doc).toContain('阶段九现场视觉复跑');
    expect(doc).toContain('阶段九现场演示讲解稿');
    expect(doc).toContain('## 当前真实完成度矩阵');
    expect(doc).toContain('## 仍需说明的缺口');
    expect(doc).toContain('## 下一阶段实施决策表');
    expect(doc).toContain('推荐路径');
  });

  it('keeps evidence links and explicit next-stage boundaries actionable', () => {
    const doc = read('docs/stage-nine-closeout-decision-review.md');

    expect(doc).toContain('docs/artifacts/stage-seven-java-real-action-click-result.json');
    expect(doc).toContain('docs/artifacts/stage-seven-supplier-java-real-action-click-result.json');
    expect(doc).toContain('docs/artifacts/stage-seven-platform-java-real-action-click-result.json');
    expect(doc).toContain('docs/artifacts/stage-nine-onsite-visual-acceptance-result.json');
    expect(doc).toContain('docs/stage-nine-demo-presenter-runbook.md');
    expect(doc).toContain('继续打磨演示闭环');
    expect(doc).toContain('合同管理');
    expect(doc).toContain('财务深化');
    expect(doc).toContain('商城直采');
    expect(doc).toContain('竞价采购');
    expect(doc).toContain('招标');
    expect(doc).toContain('AI');
    expect(doc).toContain('暂缓');
  });

  it('records the eleventh stage-nine increment in the execution checklist', () => {
    const checklist = read('docs/stage-nine-execution-checklist.md');

    expect(checklist).toContain('| 11 | 阶段九收口复盘与下一阶段决策表 |');
    expect(checklist).toContain('docs/stage-nine-closeout-decision-review.md');
    expect(checklist).toContain('推荐先完成演示版收口，再进入合同管理和财务深化');
    expect(checklist).toContain('阶段九下一轮建议继续围绕产品研发推进：按决策表进入阶段十');
  });
});
