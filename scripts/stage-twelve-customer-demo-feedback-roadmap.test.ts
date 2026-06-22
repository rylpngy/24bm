import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage twelve customer demo feedback roadmap', () => {
  it('records a post-demo feedback checklist grounded in the three-role closeout package', () => {
    const path = 'docs/stage-twelve-customer-demo-feedback-roadmap.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十二客户演示问题清单与下一阶段产品路线拆分');
    expect(doc).toContain('docs/stage-twelve-three-role-demo-closeout-package.md');
    expect(doc).toContain('采购方主流程');
    expect(doc).toContain('供应商协同');
    expect(doc).toContain('平台运营');
    expect(doc).toContain('合计 17 个真实动作');
  });

  it('classifies customer feedback into actionable buckets with handling rules', () => {
    const doc = read('docs/stage-twelve-customer-demo-feedback-roadmap.md');

    [
      '演示阻断',
      '业务理解问题',
      '生产化缺口',
      '下一业务域扩展',
      '暂缓需求',
      '判定标准',
      '处理动作',
      '验收证据',
    ].forEach((copy) => {
      expect(doc).toContain(copy);
    });
  });

  it('splits next-stage roadmap options without starting every domain at once', () => {
    const doc = read('docs/stage-twelve-customer-demo-feedback-roadmap.md');

    [
      '商城直采',
      '竞价采购',
      '合同深化',
      '财务深化',
      '平台生态',
      '生产级治理',
      '推荐优先级',
      '第一轮演示目标',
      '暂缓原因',
      '不同时启动商城直采、竞价采购、合同深化、财务深化、平台生态和生产级治理',
    ].forEach((copy) => {
      expect(doc).toContain(copy);
    });
  });

  it('recommends the next executable slice and its acceptance evidence', () => {
    const doc = read('docs/stage-twelve-customer-demo-feedback-roadmap.md');

    expect(doc).toContain('推荐下一步：客户演示问题清单模板先落地，随后按反馈选择一个下一阶段业务域');
    expect(doc).toContain('若没有演示阻断，推荐优先进入合同深化或财务深化二选一');
    expect(doc).toContain('每次只进入一个业务域');
    expect(doc).toContain('页面入口');
    expect(doc).toContain('真实动作');
    expect(doc).toContain('验收文档');
  });

  it('updates the stage twelve checklist with the post-demo feedback roadmap round', () => {
    const checklist = read('docs/stage-twelve-execution-checklist.md');

    expect(checklist).toContain('| 11 | 客户演示问题清单和下一阶段产品路线拆分 |');
    expect(checklist).toContain('docs/stage-twelve-customer-demo-feedback-roadmap.md');
    expect(checklist).toContain('scripts/stage-twelve-customer-demo-feedback-roadmap.test.ts');
    expect(checklist).toContain('下一轮建议：按客户反馈选择一个下一阶段业务域进入可演示切片');
  });
});
