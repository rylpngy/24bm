import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('product demo first development strategy', () => {
  it('locks the project direction to demo-first buyer main flow delivery', () => {
    const strategyPath = 'docs/product-demo-first-development-strategy.md';
    const checklistPath = 'docs/stage-seven-execution-checklist.md';

    expect(existsSync(strategyPath)).toBe(true);
    expect(existsSync(checklistPath)).toBe(true);

    const strategy = read(strategyPath);
    const checklist = read(checklistPath);

    expect(strategy).toContain('# 产品可演示优先研发策略');
    expect(strategy).toContain('先完成可演示业务闭环，再补工程质量');
    expect(strategy).toContain('暂停扩展新模块');
    expect(strategy).toContain('采购需求 → 审批中心 → 询价项目 → 报价对比 → 采购订单 → 收货验收 → 发票付款');
    expect(strategy).toContain('每轮只交付 1 到 2 个页面的可见改进');
    expect(strategy).toContain('不再以自动化视觉脚本作为主要推进方式');
    expect(strategy).toContain('页面能讲清楚业务状态、下一步动作和不可操作原因');

    expect(checklist).toContain('产品可演示优先');
    expect(checklist).toContain('暂停扩展新模块');
    expect(checklist).toContain('供应商侧协同演示补强');
  });
});
