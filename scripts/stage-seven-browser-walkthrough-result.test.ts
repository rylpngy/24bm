import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven browser walkthrough result', () => {
  it('records the real browser walkthrough result for buyer seven-page demo flow', () => {
    const resultPath = 'docs/stage-seven-browser-walkthrough-result.md';
    const checklistPath = 'docs/stage-seven-execution-checklist.md';

    expect(existsSync(resultPath)).toBe(true);
    expect(existsSync(checklistPath)).toBe(true);

    const result = read(resultPath);
    const checklist = read(checklistPath);

    expect(result).toContain('# 阶段七真实浏览器走查结果');
    expect(result).toContain('http://localhost:3001/');
    expect(result).toContain('desktop-1280x720');
    expect(result).toContain('mobile-390x844');
    expect(result).toContain('7 页均显示采购方主流程演示路径');
    expect(result).toContain('7 页均无整页横向溢出');
    expect(result).toContain('审批中心补充“进入询价项目跟进”按钮');

    expect(checklist).toContain('| 7 | 采购方 7 页真实浏览器走查第一轮 |');
    expect(checklist).toContain('docs/stage-seven-browser-walkthrough-result.md');
    expect(checklist).toContain('供应商侧协同演示补强');
  });

  it('adds a sequential next button from approval center to rfq tracking', () => {
    const app = read('App.tsx');

    expect(app).toContain('进入询价项目跟进');
    expect(app).toContain("onClick={() => onNavigateBuyerModule('rfqs')}");
  });
});
