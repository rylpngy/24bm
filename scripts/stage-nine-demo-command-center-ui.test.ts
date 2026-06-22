import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage nine demo command center UI', () => {
  it('adds a reusable stage-nine demo command center panel', () => {
    const component = read('components/stageEightDemoPanels.tsx');

    expect(component).toContain('export type DemoCommandCenterItem = {');
    expect(component).toContain('export const DemoCommandCenterPanel');
    expect(component).toContain('阶段九演示总线');
    expect(component).toContain('演示主线');
    expect(component).toContain('真实动作');
    expect(component).toContain('验收证据');
    expect(component).toContain('下一页');
    expect(component).toContain('data-testid="stage9-demo-command-center-panel"');
  });

  it('defines buyer, supplier and platform stage-nine command center items', () => {
    const app = read('App.tsx');

    expect(app).toContain('const buyerDemoCommandCenterItems: DemoCommandCenterItem[]');
    expect(app).toContain("storyline: '需求到付款闭环'");
    expect(app).toContain("actionCount: '7 个真实动作'");
    expect(app).toContain("evidence: 'stage-seven-java-real-action-click-result.json'");
    expect(app).toContain("nextPage: '采购需求 -> 审批中心 -> 询价项目 -> 报价对比 -> 采购订单 -> 收货验收 -> 发票付款'");

    expect(app).toContain('const supplierDemoCommandCenterItems: DemoCommandCenterItem[]');
    expect(app).toContain("storyline: '报价到应收协同'");
    expect(app).toContain("actionCount: '5 个真实动作'");
    expect(app).toContain("evidence: 'stage-seven-supplier-java-real-action-click-result.json'");
    expect(app).toContain("nextPage: '询价邀请 -> 报价记录 -> 销售订单 -> 发票应收'");

    expect(app).toContain('const platformDemoCommandCenterItems: DemoCommandCenterItem[]');
    expect(app).toContain("storyline: 'SaaS 治理和运营动作'");
    expect(app).toContain("actionCount: '5 个真实动作'");
    expect(app).toContain("evidence: 'stage-seven-platform-java-real-action-click-result.json'");
    expect(app).toContain("nextPage: '平台看板 -> 租户列表 -> 企业审核 -> 平台公告'");
  });

  it('mounts the command center in all three role workspaces before stage-eight panels', () => {
    const app = read('App.tsx');

    expect(app).toContain('items={buyerDemoCommandCenterItems}');
    expect(app).toContain('items={supplierDemoCommandCenterItems}');
    expect(app).toContain('items={platformDemoCommandCenterItems}');
    expect(app).toContain('stage9-buyer-demo-command-center');
    expect(app).toContain('stage9-supplier-demo-command-center');
    expect(app).toContain('stage9-platform-demo-command-center');
    expect(app.indexOf('stage9-buyer-demo-command-center')).toBeLessThan(app.indexOf('stage8-buyer-readonly-boundary'));
    expect(app.indexOf('stage9-supplier-demo-command-center')).toBeLessThan(app.indexOf('stage8-supplier-readonly-boundary'));
    expect(app.indexOf('stage9-platform-demo-command-center')).toBeLessThan(app.indexOf('stage8-platform-readonly-boundary'));
  });

  it('records the first stage-nine increment and keeps the product-demo boundary explicit', () => {
    const checklist = read('docs/stage-nine-execution-checklist.md');

    expect(checklist).toContain('# 阶段九执行清单');
    expect(checklist).toContain('| 1 | 三端演示总线第一轮 |');
    expect(checklist).toContain('17 个真实点击动作');
    expect(checklist).toContain('产品可演示优先');
    expect(checklist).toContain('不进入商城、竞价、招标、AI 或 ERP 集成');
    expect(checklist).toContain('不把阶段七验收通过误写成生产完成');
  });
});
