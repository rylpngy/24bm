import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage eleven buyer main-flow page polish UI', () => {
  it('extends the buyer main-flow operation strip with page consistency guidance', () => {
    const app = read('App.tsx');

    expect(app).toContain('listPolish: string;');
    expect(app).toContain('detailPolish: string;');
    expect(app).toContain('emptyStatePolish: string;');
    expect(app).toContain('buttonBoundaryPolish: string;');
    expect(app).toContain('页面一致性检查');
    expect(app).toContain('列表扫读');
    expect(app).toContain('详情层级');
    expect(app).toContain('空状态解释');
    expect(app).toContain('按钮边界');
  });

  it('defines consistency guidance for every buyer main-flow page', () => {
    const app = read('App.tsx');

    [
      '需求状态、预算、物料和下一步动作优先展示',
      '审批类型、业务对象、处理意见和处理按钮保持同屏',
      '询价状态、供应商邀请、报价数量和截止时间按同一顺序展示',
      '推荐理由、报价矩阵、定标审批和生成订单入口保持同屏',
      '供应商、金额、物流、收货和发票状态固定为订单扫读顺序',
      '物流状态、验收结果、异常原因和登记入口保持同屏',
      '对账状态、差异处理、付款计划和付款登记保持同屏',
    ].forEach((copy) => {
      expect(app).toContain(copy);
    });
  });

  it('records the second stage-eleven increment as buyer page consistency polish', () => {
    const checklist = read('docs/stage-eleven-execution-checklist.md');

    expect(checklist).toContain('| 2 | 采购方主流程页面一致性 polish |');
    expect(checklist).toContain('列表扫读、详情层级、空状态解释和按钮边界');
    expect(checklist).toContain('scripts/stage-eleven-buyer-main-flow-page-polish-ui.test.ts');
    expect(checklist).toContain('| 3 | 采购方主流程视觉密度和移动端验收 |');
    expect(checklist).toContain('| 4 | 采购方主流程移动端密度修补 |');
    expect(checklist).toContain('下一轮建议：进入阶段十二');
  });
});
