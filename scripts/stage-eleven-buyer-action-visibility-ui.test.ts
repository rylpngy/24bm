import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage eleven buyer action visibility UI', () => {
  it('adds a compact action visibility panel to the buyer key action readiness area', () => {
    const app = read('App.tsx');

    expect(app).toContain('data-testid="stage11-buyer-action-visibility"');
    expect(app).toContain('动作区可见性');
    expect(app).toContain('主按钮位置');
    expect(app).toContain('禁用原因');
    expect(app).toContain('详情区入口');
    expect(app).toContain('点击后流向');
    expect(app).toContain('primaryButtonHint');
    expect(app).toContain('disabledReasonHint');
    expect(app).toContain('detailEntryHint');
    expect(app).toContain('postClickHint');
  });

  it('defines action visibility guidance for all buyer main-flow pages', () => {
    const app = read('App.tsx');

    [
      '提交审批和创建询价按钮紧贴需求卡片动作区',
      '审批通过和驳回按钮固定在待办卡片右侧',
      '邀请供应商按钮跟随 RFQ 状态区展示',
      '定标审批和生成订单按钮固定在报价推荐区',
      '登记收货入口从订单履约状态直接衔接',
      '登记收货按钮跟随待验收订单展示',
      '登记付款入口与对账差异和付款计划同屏',
    ].forEach((copy) => {
      expect(app).toContain(copy);
    });
  });

  it('records the sixth stage-eleven increment as buyer action visibility polish', () => {
    const checklist = read('docs/stage-eleven-execution-checklist.md');

    expect(checklist).toContain('| 6 | 采购方主流程动作区可见性修补 |');
    expect(checklist).toContain('关键按钮、禁用原因、详情区入口和点击后流向');
    expect(checklist).toContain('scripts/stage-eleven-buyer-action-visibility-ui.test.ts');
    expect(checklist).toContain('下一轮建议：进入阶段十二');
  });
});
