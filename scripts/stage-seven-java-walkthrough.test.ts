import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven Java walkthrough tooling', () => {
  it('defines a buyer main-flow Java walkthrough script for the seven core pages', () => {
    const scriptPath = 'scripts/stage-seven-java-walkthrough.mjs';

    expect(existsSync(scriptPath)).toBe(true);

    const script = read(scriptPath);
    expect(script).toContain('stage-seven-java-walkthrough');
    expect(script).toContain('--screenshot=');
    expect(script).toContain('--dump-dom');
    expect(script).toContain('role=buyer&module=demands');
    expect(script).toContain('role=buyer&module=approvals');
    expect(script).toContain('role=buyer&module=rfqs');
    expect(script).toContain('role=buyer&module=quotes');
    expect(script).toContain('role=buyer&module=orders');
    expect(script).toContain('role=buyer&module=receipts');
    expect(script).toContain('role=buyer&module=invoices');
    expect(script).toContain('采购需求');
    expect(script).toContain('审批中心');
    expect(script).toContain('询价项目');
    expect(script).toContain('报价对比');
    expect(script).toContain('采购订单');
    expect(script).toContain('收货验收');
    expect(script).toContain('发票付款');
    expect(script).toContain('argument type mismatch');
    expect(script).toContain('React runtime error');
    expect(script).toContain('stage-seven-java-walkthrough-result.json');
  });

  it('records the first stage-seven execution checklist and Java walkthrough result boundary', () => {
    const checklistPath = 'docs/stage-seven-execution-checklist.md';
    const resultPath = 'docs/stage-seven-java-walkthrough-result.md';

    expect(existsSync(checklistPath)).toBe(true);
    expect(existsSync(resultPath)).toBe(true);

    const checklist = read(checklistPath);
    const result = read(resultPath);

    expect(checklist).toContain('# 阶段七执行清单');
    expect(checklist).toContain('| 1 | Java 模式采购主流程演示闭环验收脚本 |');
    expect(checklist).toContain('scripts/stage-seven-java-walkthrough.mjs');
    expect(checklist).toContain('docs/stage-seven-java-walkthrough-result.md');
    expect(checklist).toContain('供应商侧协同演示补强');

    expect(result).toContain('# 阶段七 Java 模式采购主流程演示闭环结果');
    expect(result).toContain('采购需求');
    expect(result).toContain('审批中心');
    expect(result).toContain('询价项目');
    expect(result).toContain('报价对比');
    expect(result).toContain('采购订单');
    expect(result).toContain('收货验收');
    expect(result).toContain('发票付款');
    expect(result).toContain('桌面 1280x720');
    expect(result).toContain('移动 390x844');
    expect(result).toContain('无加载失败');
    expect(result).toContain('无 `argument type mismatch`');
    expect(result).toContain('无 React runtime error');
    expect(result).toContain('stage-seven-java-walkthrough-result.json');
  });
});
