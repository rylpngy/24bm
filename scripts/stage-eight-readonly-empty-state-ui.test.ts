import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage eight readonly and empty-state UI', () => {
  it('adds a shared readonly boundary panel for finished, archived and empty states', () => {
    const component = read('components/stageEightDemoPanels.tsx');

    expect(component).toContain('export type DemoReadonlyBoundaryItem = {');
    expect(component).toContain('export const DemoReadonlyBoundaryPanel');
    expect(component).toContain('阶段八只读边界');
    expect(component).toContain('已完成');
    expect(component).toContain('已撤回');
    expect(component).toContain('已归档');
    expect(component).toContain('无数据');
    expect(component).toContain('不可操作');
    expect(component).toContain('业务解释');
    expect(component).toContain('演示兜底');
    expect(component).toContain('data-testid="stage8-readonly-boundary-panel"');
  });

  it('covers buyer-side readonly boundaries across the inquiry-to-payment flow', () => {
    const app = read('App.tsx');

    expect(app).toContain('const buyerReadonlyBoundaryItems: DemoReadonlyBoundaryItem[]');
    expect(app).toContain("state: '采购需求已提交或已审批'");
    expect(app).toContain("state: 'RFQ 已定标或已生成订单'");
    expect(app).toContain("state: '订单已收货'");
    expect(app).toContain("state: '发票已付款或批次已归档'");
    expect(app).toContain("state: '当前筛选无数据'");
  });

  it('covers supplier-side readonly boundaries driven by buyer and order state', () => {
    const app = read('App.tsx');

    expect(app).toContain('const supplierReadonlyBoundaryItems: DemoReadonlyBoundaryItem[]');
    expect(app).toContain("state: '已提交报价'");
    expect(app).toContain("state: '订单已发货或已收货'");
    expect(app).toContain("state: '发票已提交'");
    expect(app).toContain("state: '采购方已登记付款'");
    expect(app).toContain("state: '当前筛选无数据'");
  });

  it('covers platform-side governance readonly boundaries', () => {
    const app = read('App.tsx');

    expect(app).toContain('const platformReadonlyBoundaryItems: DemoReadonlyBoundaryItem[]');
    expect(app).toContain("state: '租户已停用'");
    expect(app).toContain("state: '企业已通过或已驳回'");
    expect(app).toContain("state: '公告已撤回'");
    expect(app).toContain("state: '平台公告为空'");
    expect(app).toContain("state: '平台只读治理边界'");
  });

  it('mounts readonly boundary panels in buyer, supplier and platform workspaces', () => {
    const app = read('App.tsx');

    expect(app).toContain('items={buyerReadonlyBoundaryItems}');
    expect(app).toContain('items={supplierReadonlyBoundaryItems}');
    expect(app).toContain('items={platformReadonlyBoundaryItems}');
    expect(app).toContain('stage8-buyer-readonly-boundary');
    expect(app).toContain('stage8-supplier-readonly-boundary');
    expect(app).toContain('stage8-platform-readonly-boundary');
  });

  it('records the third stage-eight increment in the execution checklist', () => {
    const checklist = read('docs/stage-eight-execution-checklist.md');

    expect(checklist).toContain('| 3 | 只读边界与空状态第一轮 |');
    expect(checklist).toContain('scripts/stage-eight-readonly-empty-state-ui.test.ts');
    expect(checklist).toContain('已完成、已撤回、已归档、无数据、不可操作');
  });
});
