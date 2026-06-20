import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage three first round card density polish', () => {
  it('keeps shared admin and workflow cards readable with long text and narrow widths', () => {
    const app = read('App.tsx');
    const adminInfoCard = app.slice(
      app.indexOf('const AdminInfoCard'),
      app.indexOf('const InlineWorkflowAction'),
    );
    const inlineWorkflowAction = app.slice(
      app.indexOf('const InlineWorkflowAction'),
      app.indexOf('const WorkflowListCard'),
    );
    const workflowCard = app.slice(
      app.indexOf('const WorkflowListCard'),
      app.indexOf('const SimpleList'),
    );

    expect(adminInfoCard).toContain('break-words text-sm font-black text-slate-950');
    expect(adminInfoCard).toContain('break-words text-xs font-bold');
    expect(adminInfoCard).not.toContain('truncate text-sm font-black');
    expect(adminInfoCard).not.toContain('truncate text-xs font-bold');

    expect(inlineWorkflowAction).toContain('sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]');
    expect(inlineWorkflowAction).toContain('min-w-0');

    expect(workflowCard).toContain('min-w-0 max-w-full');
    expect(workflowCard).toContain('max-w-full self-start');
    expect(workflowCard).toContain('min-w-0');
    expect(workflowCard).toContain('md:min-w-[12rem]');
    expect(workflowCard).toContain('md:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)]');
  });
});
