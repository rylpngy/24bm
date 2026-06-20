import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('empty state consistency UI', () => {
  it('routes shared list empty states through EmptyState instead of one-off empty boxes', () => {
    const app = read('App.tsx');

    const shellState = sliceBetween(app, 'const ShellState', 'const EmptyState');
    const emptyState = sliceBetween(app, 'const EmptyState', 'const processStateToneClasses');
    expect(shellState).toContain('min-h-[12rem]');
    expect(shellState).toContain('items-center justify-center');
    expect(shellState).toContain('text-center');
    expect(shellState).toContain('break-words text-sm font-black');
    expect(shellState).toContain('break-words text-xs font-bold leading-5');
    expect(emptyState).toContain('<ShellState variant="empty"');

    const simpleList = sliceBetween(app, 'const SimpleList', 'const DetailToggleButton');
    expect(simpleList).toContain('<EmptyState title="暂无列表数据"');
    expect(simpleList).not.toContain('border-dashed');
    expect(simpleList).not.toContain('暂无数据');

    const platformReviewPanel = sliceBetween(app, 'const PlatformEnterpriseReviewActionPanel', 'const formatEnterpriseType');
    expect(platformReviewPanel).toContain('<EmptyState title="暂无待审核企业"');
    expect(platformReviewPanel).not.toContain('<div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm font-bold text-slate-500">');

    const supplierWorkspace = sliceBetween(app, 'const SupplierWorkspaceView', 'const SupplierProfileCapabilityCard');
    expect(supplierWorkspace).toContain('filteredSupplierOpportunities.length === 0 ?');
    expect(supplierWorkspace).toContain('<EmptyState title="暂无询价邀请"');
  });
});
