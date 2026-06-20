import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('stage three filter surface rhythm UI', () => {
  it('makes shared status filters and result summaries read as a unified admin query surface', () => {
    const app = read('App.tsx');

    const statusFilter = sliceBetween(app, 'const StatusFilterControl', 'const FilterResultSummary');
    expect(statusFilter).toContain('border-l-4 border-l-blue-500 bg-white/95');
    expect(statusFilter).toContain('查询条件');
    expect(statusFilter).toContain('可选 {statusOptions.length} 项');
    expect(statusFilter).toContain('rounded-md border border-blue-100 bg-blue-50');
    expect(statusFilter).toContain('focus:bg-white');

    const filterResult = sliceBetween(app, 'const FilterResultSummary', 'const ResponsiveTableFrame');
    expect(filterResult).toContain('border-l-4 border-l-slate-300 bg-white/95');
    expect(filterResult).toContain('结果摘要');
    expect(filterResult).toContain('lg:grid-cols-[minmax(0,1fr)_auto]');
    expect(filterResult).toContain('sm:grid-cols-3');
    expect(filterResult).toContain('disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400');
    expect(filterResult).toContain('aria-disabled={!filtered}');
  });
});
