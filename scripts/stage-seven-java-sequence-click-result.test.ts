import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven Java sequence click result', () => {
  it('records the tenth stage-seven increment as Java sequence button click recheck', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');
    const walkthrough = read('docs/stage-seven-browser-walkthrough-result.md');

    expect(checklist).toContain('| 10 | Java 模式顺序按钮点击路径复核第一轮 |');
    expect(checklist).toContain('docs/artifacts/stage-seven-java-sequence-click-result.json');
    expect(checklist).toContain('供应商侧协同演示补强');

    expect(walkthrough).toContain('## Java 模式顺序按钮点击路径复核');
    expect(walkthrough).toContain('7 个顺序按钮均唯一且可点击');
    expect(walkthrough).toContain('从采购需求连续跳转到首页看板闭环');
    expect(walkthrough).toContain('点击路径失败项为 0');
  });

  it('keeps a JSON artifact for the actual Java sequence click path', () => {
    const resultPath = 'docs/artifacts/stage-seven-java-sequence-click-result.json';

    expect(existsSync(resultPath)).toBe(true);

    const result = JSON.parse(read(resultPath));
    const clickSteps = result.steps.filter((step: { type: string }) => step.type === 'click');

    expect(result.appBaseUrl).toBe('http://localhost:3000');
    expect(result.javaApiBaseUrl).toBe('http://localhost:8080');
    expect(result.failed).toEqual([]);
    expect(clickSteps).toHaveLength(7);
    expect(clickSteps.map((step: { button: string }) => step.button)).toEqual([
      '打开审批中心处理待办',
      '进入询价项目跟进',
      '进入报价对比定标',
      '查看采购订单履约',
      '进入收货验收',
      '进入发票付款',
      '主流程演示闭环',
    ]);
    expect(clickSteps.every((step: { buttonCount: number }) => step.buttonCount === 1)).toBe(true);
    expect(clickSteps.every((step: { after: { metrics: { hasExpectedLabel: boolean } } }) => step.after.metrics.hasExpectedLabel)).toBe(true);
  });
});
