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

    expect(detailPanelBody).toContain('rounded-lg bg-slate-50/70 p-2');
    expect(detailPanelBody).toContain('sm:p-3');
    expect(detailSection).toContain('border border-slate-200 bg-white p-3 shadow-sm');
    expect(panel).toContain('shadow-sm shadow-slate-200/50');
    expect(panel).toContain('border-b border-slate-100 pb-3');
    expect(workflowCard).toContain('hover:border-blue-200 hover:shadow-sm');
    expect(statusPill).toContain('max-w-full items-center whitespace-nowrap');
  });
});
