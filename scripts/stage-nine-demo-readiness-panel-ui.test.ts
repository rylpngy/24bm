import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage nine demo readiness panel UI', () => {
  it('adds a reusable readiness panel component for onsite demo checks', () => {
    const component = read('components/stageEightDemoPanels.tsx');

    expect(component).toContain('export type DemoReadinessItem = {');
    expect(component).toContain('export const DemoReadinessPanel');
    expect(component).toContain('data-testid="stage9-demo-readiness-panel"');
    expect(component).toContain('演示准备检查');
    expect(component).toContain('Java 数据源');
    expect(component).toContain('前端页面已加载');
    expect(component).toContain('17 个真实动作');
    expect(component).toContain('推荐样本');
  });

  it('wires buyer, supplier, and platform readiness panels with role-specific evidence', () => {
    const app = read('App.tsx');

    expect(app).toContain('buildDemoReadinessItems(');
    expect(app).toContain('buyerDemoReadinessItems');
    expect(app).toContain('supplierDemoReadinessItems');
    expect(app).toContain('platformDemoReadinessItems');
    expect(app).toContain('DemoReadinessPanel');
    expect(app).toContain('stage-seven-java-real-action-click-result.json');
    expect(app).toContain('stage-seven-supplier-java-real-action-click-result.json');
    expect(app).toContain('stage-seven-platform-java-real-action-click-result.json');
  });

  it('keeps readiness checks demo-only without adding backend routes or router dependencies', () => {
    const app = read('App.tsx');

    expect(app).toContain('status={javaEnabled ?');
    expect(app).toContain('前端页面已加载');
    expect(app).toContain('推荐样本已标记');
    expect(app).not.toContain('react-router-dom');
    expect(app).not.toContain('/api/v1/demo-readiness');
  });

  it('records the seventh stage-nine increment in the checklist', () => {
    const checklist = read('docs/stage-nine-execution-checklist.md');

    expect(checklist).toContain('| 7 | 演示准备检查面板第一轮 |');
    expect(checklist).toContain('Java 数据源、17 个动作、推荐样本、前后端健康状态');
    expect(checklist).toContain('scripts/stage-nine-demo-readiness-panel-ui.test.ts');
  });
});
