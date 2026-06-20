import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage three first round UI polish', () => {
  it('tightens panel, detail, card, and status primitives for a more finished admin feel', () => {
    const app = read('App.tsx');
    const detailPanelBody = app.slice(
      app.indexOf('const DetailPanelBody'),
      app.indexOf('const DetailHeroCard'),
    );
    const detailSection = app.slice(
      app.indexOf('const DetailSection'),
      app.indexOf('const parseAttachmentNames'),
    );
    const panel = app.slice(
      app.indexOf('const Panel'),
      app.indexOf('const WorkflowRail'),
    );
    const workflowCard = app.slice(
      app.indexOf('const WorkflowListCard'),
      app.indexOf('const SimpleList'),
    );
    const statusPill = app.slice(
      app.indexOf('const StatusPill'),
      app.indexOf('export default App'),
    );

    expect(detailPanelBody).toContain('rounded-lg border border-slate-200/70 bg-slate-50/70 p-2');
    expect(detailPanelBody).toContain('shadow-inner shadow-slate-200/50');
    expect(detailPanelBody).toContain('sm:p-3');
    expect(detailSection).toContain('border border-slate-200 bg-white p-3 shadow-sm');
    expect(panel).toContain('shadow-sm shadow-slate-200/50');
    expect(panel).toContain('border-b border-slate-100 pb-3');
    expect(workflowCard).toContain('hover:border-blue-200 hover:shadow-sm');
    expect(statusPill).toContain('max-w-full min-w-0 items-center break-words');
    expect(statusPill).not.toContain('whitespace-nowrap');
  });

  it('makes shared list surfaces feel like dense admin pages instead of placeholder cards', () => {
    const app = read('App.tsx');
    const listToolbar = app.slice(
      app.indexOf('const ListToolbar'),
      app.indexOf('const StatusFilterControl'),
    );
    const statusFilter = app.slice(
      app.indexOf('const StatusFilterControl'),
      app.indexOf('const FilterResultSummary'),
    );
    const filterResult = app.slice(
      app.indexOf('const FilterResultSummary'),
      app.indexOf('const ResponsiveTableFrame'),
    );
    const panel = app.slice(
      app.indexOf('const Panel'),
      app.indexOf('const WorkflowRail'),
    );
    const adminInfoCard = app.slice(
      app.indexOf('const AdminInfoCard'),
      app.indexOf('const InlineWorkflowAction'),
    );
    const workflowCard = app.slice(
      app.indexOf('const WorkflowListCard'),
      app.indexOf('const SimpleList'),
    );

    expect(listToolbar).toContain('bg-white/95');
    expect(listToolbar).toContain('shadow-sm shadow-slate-200/70');
    expect(listToolbar).toContain('aria-label="使用顶部搜索框筛选当前列表"');
    expect(listToolbar).toContain('aria-label="使用下方状态筛选器筛选当前列表"');
    expect(listToolbar).toContain('border-l-4 border-l-blue-500');
    expect(statusFilter).toContain('md:flex-row md:items-center md:justify-between');
    expect(statusFilter).toContain('当前值：{value}');
    expect(filterResult).toContain('border-slate-200 border-l-4 border-l-slate-300 bg-white/95');
    expect(filterResult).toContain('结果摘要');
    expect(filterResult).toContain('rounded-md border border-blue-100 bg-blue-50');
    expect(panel).toContain('break-words font-black text-slate-950');
    expect(adminInfoCard).toContain('border-l-4');
    expect(workflowCard).toContain('border-l-4');
    expect(workflowCard).toContain('rounded-lg bg-slate-50/70 p-2');
  });
});
