import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('stage three list action surface UI', () => {
  it('turns workflow card actions into a clear admin operation surface', () => {
    const app = read('App.tsx');

    const workflowCard = sliceBetween(app, 'const WorkflowListCard', 'const SimpleList');
    expect(workflowCard).toContain('操作状态');
    expect(workflowCard).toContain('border border-slate-200 bg-slate-50/80');
    expect(workflowCard).toContain('md:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)]');
    expect(workflowCard).toContain('rounded-md border border-white/80 bg-white/70');
    expect(workflowCard).toContain('aria-label={`${title} 状态与详情`}');
    expect(workflowCard).toContain('aria-label={`${title} 快捷动作`}');

    const inlineAction = sliceBetween(app, 'const InlineWorkflowAction', 'const WorkflowListCard');
    expect(inlineAction).toContain('快捷动作');
    expect(inlineAction).toContain('shadow-inner shadow-white/60');
    expect(inlineAction).toContain('border-t border-white/70 pt-3');
  });
});
