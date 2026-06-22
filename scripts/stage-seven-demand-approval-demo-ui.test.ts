import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven demand and approval demo-first UI', () => {
  it('adds a buyer demand demo panel that explains the demand to approval handoff', () => {
    const app = read('App.tsx');

    expect(app).toContain('需求到审批演示台');
    expect(app).toContain('演示路径：先创建或选择采购需求，再提交审批，审批通过后回到需求页创建询价。');
    expect(app).toContain('待提交审批');
    expect(app).toContain('审批中需求');
    expect(app).toContain('可创建询价');
    expect(app).toContain('打开审批中心处理待办');
  });

  it('adds an approval demo panel that explains review decisions and follow-up navigation', () => {
    const app = read('App.tsx');

    expect(app).toContain('审批处理演示台');
    expect(app).toContain('演示路径：选择待审批事项，填写审批意见并确认影响，再通过或驳回。');
    expect(app).toContain('待处理审批');
    expect(app).toContain('最近处理');
    expect(app).toContain('审批通过后回到采购需求继续创建询价');
    expect(app).toContain('返回采购需求查看结果');
  });

  it('records the third stage-seven increment as demand and approval demo polish', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(checklist).toContain('| 3 | 采购需求与审批中心演示体验第一轮 |');
    expect(checklist).toContain('需求到审批演示台');
    expect(checklist).toContain('审批处理演示台');
    expect(checklist).toContain('scripts/stage-seven-demand-approval-demo-ui.test.ts');
    expect(checklist).toContain('供应商侧协同演示补强');
  });
});
