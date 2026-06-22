import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage eight execution plan', () => {
  it('defines the demo-productization scope, sequence, and acceptance gates', () => {
    const plan = read('docs/stage-eight-execution-plan.md');
    const checklist = read('docs/stage-eight-execution-checklist.md');

    expect(plan).toContain('# 阶段八演示链路产品化加固计划');
    expect(plan).toContain('阶段八目标');
    expect(plan).toContain('17 个真实点击动作');
    expect(plan).toContain('用户看得见的业务体验');

    expect(plan).toContain('不扩新模块');
    expect(plan).toContain('不进入商城、竞价、招标、AI 或 ERP 集成');
    expect(plan).toContain('不把演示口径包装成生产完成');

    expect(plan).toContain('第一轮：三端动作反馈与失败提示');
    expect(plan).toContain('第二轮：只读边界与空状态');
    expect(plan).toContain('第三轮：移动端和密度收敛');
    expect(plan).toContain('第四轮：高频组件抽取');
    expect(plan).toContain('第五轮：权限与审计演示增强');

    expect(plan).toContain('采购方');
    expect(plan).toContain('供应商');
    expect(plan).toContain('平台端');
    expect(plan).toContain('三端现场演示总验收包');

    expect(plan).toContain('node scripts/stage-seven-onsite-demo-acceptance-check.mjs');
    expect(plan).toContain('npm run java:smoke');
    expect(plan).toContain('npm test');
    expect(plan).toContain('npm run build');

    expect(checklist).toContain('# 阶段八执行清单');
    expect(checklist).toContain('| 1 | 阶段八演示链路产品化加固计划 |');
    expect(checklist).toContain('docs/stage-eight-execution-plan.md');
    expect(checklist).toContain('scripts/stage-eight-execution-plan.test.ts');
    expect(checklist).toContain('| 2 | 三端动作反馈与失败提示第一轮 |');
    expect(checklist).toContain('| 3 | 只读边界与空状态第一轮 |');
    expect(checklist).toContain('| 4 | 移动端和密度收敛第一轮 |');
    expect(checklist).toContain('| 5 | 高频组件抽取第一轮 |');
    expect(checklist).toContain('| 6 | 权限与审计演示增强第一轮 |');
    expect(checklist).toContain('阶段八第一轮演示链路产品化加固收束');
  });
});
