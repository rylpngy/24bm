import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('admin shell polish UI', () => {
  it('keeps long navigation and workspace content scrollable within the viewport', () => {
    const app = read('App.tsx');

    expect(app).toContain('h-dvh overflow-hidden');
    expect(app).toContain('min-h-0 flex-1 flex-col');
    expect(app).toContain('min-h-0 flex-1 overflow-y-auto');
    expect(app).toContain('overscroll-contain');
    expect(app).toContain('max-w-full');
  });

  it('uses shared state components for loading, errors, and empty content', () => {
    const app = read('App.tsx');

    expect(app).toContain('ShellState');
    expect(app).toContain("variant: 'loading' | 'error' | 'empty'");
    expect(app).toContain('加载失败');
    expect(app).toContain('正在加载采购工作台');
    expect(app).toContain('EmptyState');
    expect(app).toContain('variant="empty"');
  });

  it('marks active role and module navigation items for accessible admin state', () => {
    const app = read('App.tsx');

    expect(app).toContain('aria-current={roleActive ?');
    expect(app).toContain('aria-pressed={roleActive}');
    expect(app).toContain('aria-current={moduleActive ?');
    expect(app).toContain('aria-pressed={moduleActive}');
  });

  it('uses a shared accessible detail toggle for buyer list-to-detail actions', () => {
    const app = read('App.tsx');

    expect(app).toContain('const DetailToggleButton');
    expect(app).toContain('aria-current={selected ?');
    expect(app).toContain('aria-pressed={selected}');
    expect(app.match(/<DetailToggleButton/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('uses a shared primary action button for buyer workflow commands', () => {
    const app = read('App.tsx');

    expect(app).toContain('const PrimaryActionButton');
    expect(app).toContain("tone?: 'blue' | 'emerald' | 'amber'");
    expect(app).toContain('aria-busy={busy || undefined}');
    expect(app.match(/<PrimaryActionButton/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it('uses a shared process state notice for handled or waiting workflow cards', () => {
    const app = read('App.tsx');

    expect(app).toContain('const ProcessStateNotice');
    expect(app).toContain("variant: 'handled' | 'waiting'");
    expect(app).toContain('流程已处理');
    expect(app).toContain('等待供应商响应');
    expect(app.match(/<ProcessStateNotice/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('uses a shared table detail button for dense buyer tables', () => {
    const app = read('App.tsx');

    expect(app).toContain('const TableDetailButton');
    expect(app).toContain('aria-current={selected ?');
    expect(app).toContain('aria-pressed={selected}');
    expect(app.match(/<TableDetailButton/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it('uses shared responsive detail panel primitives for dense detail views', () => {
    const app = read('App.tsx');

    expect(app).toContain('const DetailPanelBody');
    expect(app).toContain('className="space-y-3 sm:space-y-4"');
    expect(app).toContain('break-words');
    expect(app).toContain('min-w-0');
    expect(app.match(/<DetailPanelBody>/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it('uses shared detail row components for trace and related business sections', () => {
    const app = read('App.tsx');

    expect(app).toContain('const DetailKeyValueRow');
    expect(app).toContain('const RelatedBusinessRow');
    expect(app).toContain('fontMono?: boolean');
    expect(app.match(/<DetailKeyValueRow/g)?.length).toBeGreaterThanOrEqual(6);
    expect(app.match(/<RelatedBusinessRow/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
