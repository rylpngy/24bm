import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('stage three admin workbench rhythm UI', () => {
  it('gives the admin shell stable scroll rhythm and clearer shared surface hierarchy', () => {
    const app = read('App.tsx');

    const appShell = sliceBetween(app, 'return (\n    <div className="flex h-dvh', 'const AppSidebar');
    expect(appShell).toContain('[scrollbar-gutter:stable]');
    expect(appShell).toContain('bg-slate-100/70');
    expect(appShell).toContain('space-y-5 p-3 pb-8 sm:space-y-6 sm:p-6 lg:p-8');

    const appHeader = sliceBetween(app, 'const AppHeader', 'const Select');
    expect(appHeader).toContain('bg-white/95');
    expect(appHeader).toContain('shadow-sm shadow-slate-200/70');
    expect(appHeader).toContain('backdrop-blur');

    const listToolbar = sliceBetween(app, 'const ListToolbar', 'const StatusFilterControl');
    expect(listToolbar).toContain('bg-white/95');
    expect(listToolbar).toContain('shadow-sm shadow-slate-200/70');
    expect(listToolbar).toContain('lg:items-start');

    const detailPanelBody = sliceBetween(app, 'const DetailPanelBody', 'const DetailHeroCard');
    expect(detailPanelBody).toContain('border border-slate-200/70');
    expect(detailPanelBody).toContain('shadow-inner shadow-slate-200/50');

    const detailHeroCard = sliceBetween(app, 'const DetailHeroCard', 'const DetailSection');
    expect(detailHeroCard).toContain('shadow-sm shadow-slate-200/60');

    const responsiveSummaryCard = sliceBetween(app, 'const ResponsiveSummaryCard', 'const Panel');
    expect(responsiveSummaryCard).toContain('shadow-sm shadow-slate-200/50');
    expect(responsiveSummaryCard).toContain('active:scale-[0.995]');
  });
});
