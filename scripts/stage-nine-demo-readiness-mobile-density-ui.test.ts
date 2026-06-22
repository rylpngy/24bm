import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('stage nine demo readiness mobile density UI', () => {
  it('bounds readiness check cards on 390px mobile while preserving desktop four-column density', () => {
    const component = read('components/stageEightDemoPanels.tsx');
    const readinessPanel = sliceBetween(component, 'export const DemoReadinessPanel', 'export const DemoCommandCenterPanel');

    expect(readinessPanel).toContain('data-testid="stage9-demo-readiness-panel"');
    expect(readinessPanel).toContain('className="mt-3 grid max-h-[24rem] gap-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-none sm:overflow-visible sm:pr-0 xl:grid-cols-4"');
    expect(readinessPanel).toContain('className="mt-2 rounded-md bg-white/70 px-2.5 py-1.5 text-[11px] font-black leading-5 text-teal-700 sm:text-xs"');
    expect(readinessPanel).toContain('className="inline-flex min-h-8 max-w-full shrink-0 items-center gap-1.5');
    expect(readinessPanel).not.toContain('min-w-[520px]');
    expect(readinessPanel).not.toContain('className="mt-3 grid gap-2 xl:grid-cols-4"');
  });

  it('records the eighth stage-nine increment and moves the pending item forward', () => {
    const checklist = read('docs/stage-nine-execution-checklist.md');

    expect(checklist).toContain('| 8 | 演示准备检查移动端密度第一轮 |');
    expect(checklist).toContain('390px 视口下准备检查面板');
    expect(checklist).toContain('scripts/stage-nine-demo-readiness-mobile-density-ui.test.ts');
    expect(checklist).toContain('按决策表进入阶段十');
    expect(checklist).not.toContain('补移动端 `390px` 视口下准备检查面板、演示总线和推荐样本卡片的阅读密度复核。');
  });
});
