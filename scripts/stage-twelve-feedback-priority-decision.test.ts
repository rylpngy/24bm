import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage twelve feedback and priority decision', () => {
  it('documents the stage-twelve decision entry with stage-eleven evidence', () => {
    const path = 'docs/stage-twelve-feedback-priority-decision.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十二客户反馈与下一业务域优先级决策表');
    expect(doc).toContain('## 决策结论');
    expect(doc).toContain('阶段十一采购方主流程演示包');
    expect(doc).toContain('docs/stage-eleven-closeout-acceptance-package.md');
    expect(doc).toContain('docs/stage-eleven-customer-demo-runbook.md');
    expect(doc).toContain('docs/artifacts/stage-eleven-buyer-main-flow-visual-density-result.json');
    expect(doc).toContain('14 个页面/视口组合');
    expect(doc).toContain('17 个真实动作');
  });

  it('captures customer feedback buckets with concrete handling rules', () => {
    const doc = read('docs/stage-twelve-feedback-priority-decision.md');

    [
      '客户反馈分类',
      '演示阻断',
      '业务理解问题',
      '业务域新增需求',
      '生产上线要求',
      '暂不处理',
      '处理规则',
      '进入条件',
      '验收证据',
    ].forEach((copy) => {
      expect(doc).toContain(copy);
    });
  });

  it('prioritizes the next business domains without reopening all roadmap items at once', () => {
    const doc = read('docs/stage-twelve-feedback-priority-decision.md');

    expect(doc).toContain('## 下一业务域优先级决策表');
    expect(doc).toContain('供应商协同深化');
    expect(doc).toContain('平台运营深化');
    expect(doc).toContain('商城直采');
    expect(doc).toContain('竞价采购');
    expect(doc).toContain('复杂招标');
    expect(doc).toContain('AI 智能化');
    expect(doc).toContain('推荐进入');
    expect(doc).toContain('暂缓');
    expect(doc).toContain('不同时启动商城、竞价、招标和 AI');
  });

  it('adds a stage-twelve execution checklist for the first decision round', () => {
    const path = 'docs/stage-twelve-execution-checklist.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十二执行清单');
    expect(doc).toContain('| 1 | 客户反馈与下一业务域优先级决策 |');
    expect(doc).toContain('docs/stage-twelve-feedback-priority-decision.md');
    expect(doc).toContain('scripts/stage-twelve-feedback-priority-decision.test.ts');
    expect(doc).toContain('下一轮建议：优先进入供应商协同深化');
  });
});
