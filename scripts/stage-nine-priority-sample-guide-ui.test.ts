import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage nine priority sample guide UI', () => {
  it('extends current action guides with priority demo sample metadata', () => {
    const component = read('components/stageEightDemoPanels.tsx');

    expect(component).toContain('prioritySample: string;');
    expect(component).toContain('sampleLocator: string;');
    expect(component).toContain('优先样本');
    expect(component).toContain('样本定位');
  });

  it('adds buyer priority samples for the main demo pages', () => {
    const app = read('App.tsx');

    expect(app).toContain("prioritySample: 'dem-stage7-submit-ready / dem-stage7-rfq-ready'");
    expect(app).toContain("sampleLocator: '采购需求列表中优先找阶段七演示需求卡片'");
    expect(app).toContain("prioritySample: 'approval-stage7-demand-pending'");
    expect(app).toContain("sampleLocator: '审批中心待办里优先找阶段七需求审批'");
    expect(app).toContain("prioritySample: 'rfq-stage7-award-ready / award-stage7-order-ready'");
    expect(app).toContain("sampleLocator: '报价对比页优先打开阶段七定标和生成订单样本'");
    expect(app).toContain("prioritySample: 'po-stage7-receipt-ready'");
    expect(app).toContain("prioritySample: 'inv-stage7-payment-ready'");
  });

  it('adds supplier and platform priority samples for their real-click pages', () => {
    const app = read('App.tsx');

    expect(app).toContain("prioritySample: 'rfq-stage7-supplier-quote-ready'");
    expect(app).toContain("sampleLocator: '询价邀请列表中优先找阶段七供应商报价样本'");
    expect(app).toContain("prioritySample: 'po-stage7-supplier-confirm-ready / po-stage7-supplier-delivery-ready / po-stage7-supplier-invoice-ready'");
    expect(app).toContain("prioritySample: 'inv-stage7-supplier-receivable-ready'");

    expect(app).toContain("prioritySample: 'tenant-stage7-platform-action'");
    expect(app).toContain("prioritySample: 'ent-stage7-platform-review-ready'");
    expect(app).toContain("prioritySample: 'announcement-stage7-platform-withdraw-ready'");
    expect(app).toContain("sampleLocator: '平台公告页优先发布新公告，再选择可撤回公告'");
  });

  it('records the third stage-nine increment in the checklist', () => {
    const checklist = read('docs/stage-nine-execution-checklist.md');

    expect(checklist).toContain('| 3 | 优先演示样本提示第一轮 |');
    expect(checklist).toContain('优先样本和样本定位');
    expect(checklist).toContain('scripts/stage-nine-priority-sample-guide-ui.test.ts');
  });
});
