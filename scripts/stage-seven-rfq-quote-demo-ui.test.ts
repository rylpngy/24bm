import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven rfq and quote demo-first UI', () => {
  it('adds a buyer rfq demo panel that makes supplier invitation and quote readiness visible', () => {
    const app = read('App.tsx');

    expect(app).toContain('询价协同演示台');
    expect(app).toContain('演示路径：从已审批需求进入询价，补齐邀请供应商、报价要求和截止时间，再进入报价对比。');
    expect(app).toContain('待补邀请');
    expect(app).toContain('报价不足');
    expect(app).toContain('可进入比价');
    expect(app).toContain('进入报价对比定标');
  });

  it('adds a quote comparison demo panel that makes award recommendation and order handoff visible', () => {
    const app = read('App.tsx');

    expect(app).toContain('比价定标演示台');
    expect(app).toContain('演示路径：先核对报价比较矩阵和推荐理由，再提交定标审批，审批通过后生成采购订单。');
    expect(app).toContain('可提交定标');
    expect(app).toContain('推荐定标项目');
    expect(app).toContain('定标审批中');
    expect(app).toContain('生成订单后只读');
    expect(app).toContain('查看采购订单履约');
  });

  it('records the fourth stage-seven increment as rfq and quote demo polish', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(checklist).toContain('| 4 | 询价项目与报价对比演示体验第一轮 |');
    expect(checklist).toContain('询价协同演示台');
    expect(checklist).toContain('比价定标演示台');
    expect(checklist).toContain('scripts/stage-seven-rfq-quote-demo-ui.test.ts');
    expect(checklist).toContain('供应商侧协同演示补强');
  });
});
