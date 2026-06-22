import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage eight action feedback UI', () => {
  it('adds a shared demo action feedback panel with prerequisite, success, fallback and next-step copy', () => {
    const component = read('components/stageEightDemoPanels.tsx');

    expect(component).toContain('export type DemoActionFeedbackItem = {');
    expect(component).toContain('export const DemoActionFeedbackPanel');
    expect(component).toContain('阶段八动作反馈');
    expect(component).toContain('前置条件');
    expect(component).toContain('成功反馈');
    expect(component).toContain('失败兜底');
    expect(component).toContain('下一步');
    expect(component).toContain('data-testid="stage8-demo-action-feedback-panel"');
  });

  it('covers the seven buyer demo actions with visible feedback guidance', () => {
    const app = read('App.tsx');

    expect(app).toContain('const buyerDemoActionFeedbackItems: DemoActionFeedbackItem[]');
    expect(app).toContain("action: '提交审批'");
    expect(app).toContain("action: '通过审批'");
    expect(app).toContain("action: '创建询价'");
    expect(app).toContain("action: '提交定标审批'");
    expect(app).toContain("action: '生成采购订单'");
    expect(app).toContain("action: '登记收货'");
    expect(app).toContain("action: '登记付款'");
    expect(app).toContain('采购方 7 个真实点击动作');
  });

  it('covers the five supplier demo actions with tenant and buyer-driven boundary guidance', () => {
    const app = read('App.tsx');

    expect(app).toContain('const supplierDemoActionFeedbackItems: DemoActionFeedbackItem[]');
    expect(app).toContain("action: '提交报价'");
    expect(app).toContain("action: '确认订单'");
    expect(app).toContain("action: '提交发货'");
    expect(app).toContain("action: '提交发票'");
    expect(app).toContain("action: '保存对账备注'");
    expect(app).toContain('供应商 5 个真实点击动作');
    expect(app).toContain('供应商只能处理自己的邀请、订单和应收记录');
  });

  it('covers the five platform demo actions with SaaS governance boundaries', () => {
    const app = read('App.tsx');

    expect(app).toContain('const platformDemoActionFeedbackItems: DemoActionFeedbackItem[]');
    expect(app).toContain("action: '停用租户'");
    expect(app).toContain("action: '升级专业版'");
    expect(app).toContain("action: '通过企业审核'");
    expect(app).toContain("action: '发布平台公告'");
    expect(app).toContain("action: '撤回平台公告'");
    expect(app).toContain('平台端 5 个真实点击动作');
    expect(app).toContain('平台只做 SaaS 治理，不直接修改采购业务单据');
  });

  it('mounts the feedback panel in buyer, supplier and platform workspaces', () => {
    const app = read('App.tsx');

    expect(app).toContain('items={buyerDemoActionFeedbackItems}');
    expect(app).toContain('items={supplierDemoActionFeedbackItems}');
    expect(app).toContain('items={platformDemoActionFeedbackItems}');
    expect(app).toContain('stage8-buyer-action-feedback');
    expect(app).toContain('stage8-supplier-action-feedback');
    expect(app).toContain('stage8-platform-action-feedback');
  });

  it('records the second stage-eight increment in the execution checklist', () => {
    const checklist = read('docs/stage-eight-execution-checklist.md');

    expect(checklist).toContain('| 2 | 三端动作反馈与失败提示第一轮 |');
    expect(checklist).toContain('scripts/stage-eight-action-feedback-ui.test.ts');
    expect(checklist).toContain('操作前置条件、成功反馈、失败兜底和下一步说明');
  });
});
