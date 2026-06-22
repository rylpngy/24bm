import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('stage eight mobile density UI', () => {
  it('keeps buyer and platform demo walkthrough rails responsive without fixed mobile overflow tracks', () => {
    const app = read('App.tsx');
    const component = read('components/stageEightDemoPanels.tsx');

    expect(component).toContain('export const DemoWalkthroughRail');
    expect(component).toContain('className={`grid gap-2 ${gridClassName}`}');
    expect(app).toContain('ariaLabel="平台运营演示路径"');
    expect(app).toContain('gridClassName="grid-cols-2 sm:grid-cols-4"');
    expect(app).not.toContain('min-w-[520px]');

    expect(app).toContain('ariaLabel="采购方主流程演示路径"');
    expect(app).toContain('gridClassName="grid-cols-2 sm:grid-cols-4 xl:grid-cols-7"');
    expect(app).not.toContain('min-w-[760px]');
  });

  it('bounds stage-eight action feedback cards on mobile while keeping desktop density readable', () => {
    const component = read('components/stageEightDemoPanels.tsx');

    const actionPanel = sliceBetween(component, 'export const DemoActionFeedbackPanel', 'export const DemoReadonlyBoundaryPanel');
    expect(actionPanel).toContain('className="overflow-hidden rounded-lg border border-indigo-100 bg-indigo-50 p-3 shadow-sm shadow-indigo-100/60 sm:p-4"');
    expect(actionPanel).toContain('className="mt-3 grid max-h-[26rem] gap-2 overflow-y-auto overscroll-contain pr-1 sm:mt-4 sm:max-h-none sm:gap-3 sm:overflow-visible sm:pr-0 xl:grid-cols-2"');
    expect(actionPanel).toContain('className="inline-flex min-h-8 max-w-full shrink-0 items-center');
    expect(actionPanel).toContain('className="rounded-lg border border-white bg-white p-2.5 shadow-sm shadow-indigo-100/40 sm:p-3"');
  });

  it('bounds stage-eight readonly boundary cards on mobile while preserving all explanations', () => {
    const component = read('components/stageEightDemoPanels.tsx');

    const readonlyPanel = component.slice(component.indexOf('export const DemoReadonlyBoundaryPanel'));
    expect(readonlyPanel).toContain('className="overflow-hidden rounded-lg border border-amber-100 bg-amber-50 p-3 shadow-sm shadow-amber-100/60 sm:p-4"');
    expect(readonlyPanel).toContain('className="mt-3 grid max-h-[26rem] gap-2 overflow-y-auto overscroll-contain pr-1 sm:mt-4 sm:max-h-none sm:gap-3 sm:overflow-visible sm:pr-0 xl:grid-cols-2"');
    expect(readonlyPanel).toContain('className="inline-flex min-h-8 max-w-full shrink-0 items-center');
    expect(readonlyPanel).toContain('className="rounded-lg border border-white bg-white p-2.5 shadow-sm shadow-amber-100/40 sm:p-3"');
  });

  it('records the fourth stage-eight increment in the execution checklist', () => {
    const checklist = read('docs/stage-eight-execution-checklist.md');

    expect(checklist).toContain('| 4 | 移动端和密度收敛第一轮 |');
    expect(checklist).toContain('scripts/stage-eight-mobile-density-ui.test.ts');
    expect(checklist).toContain('390px 窄屏');
  });
});
