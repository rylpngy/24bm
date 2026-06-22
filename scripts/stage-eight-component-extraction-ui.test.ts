import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage eight component extraction UI', () => {
  it('extracts demo panels and walkthrough rails into a reusable component module', () => {
    const app = read('App.tsx');
    const componentPath = 'components/stageEightDemoPanels.tsx';

    expect(existsSync(componentPath)).toBe(true);
    expect(app).toContain("from './components/stageEightDemoPanels'");
    expect(app).toContain('DemoActionFeedbackPanel,');
    expect(app).toContain('DemoReadonlyBoundaryPanel,');
    expect(app).toContain('DemoWalkthroughRail,');

    const component = read(componentPath);
    expect(component).toContain('export type DemoActionFeedbackItem = {');
    expect(component).toContain('export type DemoReadonlyBoundaryItem = {');
    expect(component).toContain('export type DemoWalkthroughStep<ModuleId extends string> = {');
    expect(component).toContain('export const DemoActionFeedbackPanel');
    expect(component).toContain('export const DemoReadonlyBoundaryPanel');
    expect(component).toContain('export const DemoWalkthroughRail');
    expect(component).toContain('const DemoFact');
  });

  it('removes duplicated buyer and platform walkthrough rail implementations from App', () => {
    const app = read('App.tsx');

    expect(app).not.toContain('const PlatformDemoWalkthroughRail: React.FC');
    expect(app).not.toContain('const BuyerDemoWalkthroughRail: React.FC');
    expect(app).toContain('<DemoWalkthroughRail');
    expect(app).toContain('steps={platformDemoWalkthroughSteps}');
    expect(app).toContain('steps={buyerDemoWalkthroughSteps}');
    expect(app).toContain('gridClassName="grid-cols-2 sm:grid-cols-4"');
    expect(app).toContain('gridClassName="grid-cols-2 sm:grid-cols-4 xl:grid-cols-7"');
  });

  it('records the fifth stage-eight increment in the execution checklist', () => {
    const checklist = read('docs/stage-eight-execution-checklist.md');

    expect(checklist).toContain('| 5 | 高频组件抽取第一轮 |');
    expect(checklist).toContain('components/stageEightDemoPanels.tsx');
    expect(checklist).toContain('scripts/stage-eight-component-extraction-ui.test.ts');
    expect(checklist).toContain('| 6 | 权限与审计演示增强第一轮 |');
  });
});
