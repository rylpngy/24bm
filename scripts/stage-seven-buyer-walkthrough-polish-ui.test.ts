import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven buyer seven-page walkthrough polish', () => {
  it('adds a unified buyer walkthrough rail for the seven demo pages', () => {
    const app = read('App.tsx');
    const component = read('components/stageEightDemoPanels.tsx');

    expect(app).toContain('采购方主流程演示路径');
    expect(app).toContain('需求申请');
    expect(app).toContain('审批处理');
    expect(app).toContain('询价协同');
    expect(app).toContain('比价定标');
    expect(app).toContain('订单履约');
    expect(app).toContain('收货验收');
    expect(app).toContain('发票付款');
    expect(component).toContain('当前演示页');
    expect(component).toContain('下一演示页');
  });

  it('renders the walkthrough rail only for buyer main-flow pages', () => {
    const app = read('App.tsx');

    expect(app).toContain('buyerDemoWalkthroughModules.includes(activeModule as BuyerAdminModule)');
    expect(app).toContain('<DemoWalkthroughRail');
    expect(app).toContain('activeModule={activeModule as BuyerAdminModule}');
    expect(app).toContain('steps={buyerDemoWalkthroughSteps}');
    expect(app).toContain('onNavigate={(moduleId) => onNavigateBuyerModule(moduleId)}');
  });

  it('records the sixth stage-seven increment as buyer walkthrough polish', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(checklist).toContain('| 6 | 采购方 7 页演示走查和视觉收敛第一轮 |');
    expect(checklist).toContain('采购方主流程演示路径');
    expect(checklist).toContain('scripts/stage-seven-buyer-walkthrough-polish-ui.test.ts');
    expect(checklist).toContain('供应商侧协同演示补强');
  });
});
