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
});
