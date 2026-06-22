import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('admin URL module entry', () => {
  it('supports URL search params for opening a role module without react-router', () => {
    const app = read('App.tsx');

    expect(app).toContain('resolveInitialAdminShellState');
    expect(app).toContain('new URLSearchParams(window.location.search)');
    expect(app).toContain("searchParams.get('role')");
    expect(app).toContain("searchParams.get('module')");
    expect(app).toContain('defaultAdminModulesByRole');
    expect(app).toContain('adminRoleNavigation');
  });

  it('documents the Java visual check deep link for invoice payment', () => {
    const script = read('scripts/stage-four-java-visual-check.mjs');
    const doc = read('docs/stage-four-java-visual-walkthrough-result.md');

    expect(script).toContain('role=buyer&module=invoices');
    expect(doc).toContain('http://127.0.0.1:3001/?role=buyer&module=invoices');
  });
});
