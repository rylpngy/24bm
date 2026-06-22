import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage eleven buyer first-screen focus UI', () => {
  it('adds a compact first-screen business focus panel for buyer demo pages', () => {
    const app = read('App.tsx');

    expect(app).toContain('data-testid="stage11-buyer-first-screen-focus"');
    expect(app).toContain('首屏业务焦点');
    expect(app).toContain('详情首屏');
    expect(app).toContain('列表卡片高度');
    expect(app).toContain('下一步动作');
    expect(app).toContain('densityHint');
    expect(app).toContain('listHeightHint');
    expect(app).toContain('statusLabel');
  });

  it('defines first-screen focus guidance for all seven buyer main-flow pages', () => {
    const app = read('App.tsx');

    [
      '需求摘要、预算、审批状态和询价入口同屏可见',
      '审批对象、处理意见、处理按钮和流转结果同屏可见',
      'RFQ 摘要、邀请供应商、截止时间和报价数量同屏可见',
      '报价矩阵、推荐理由、定标审批和生成订单入口同屏可见',
      '订单摘要、履约时间线、供应商确认和收货入口同屏可见',
      '物流状态、验收结果、异常原因和发票衔接同屏可见',
      '对账差异、付款计划、逾期提醒和付款登记同屏可见',
    ].forEach((copy) => {
      expect(app).toContain(copy);
    });
  });

  it('records the fifth stage-eleven increment as first-screen focus polish', () => {
    const checklist = read('docs/stage-eleven-execution-checklist.md');

    expect(checklist).toContain('| 5 | 采购方主流程首屏业务焦点修补 |');
    expect(checklist).toContain('详情区首屏信息密度和列表卡片高度');
    expect(checklist).toContain('scripts/stage-eleven-buyer-first-screen-focus-ui.test.ts');
    expect(checklist).toContain('下一轮建议：进入阶段十二');
  });
});
