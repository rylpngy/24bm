import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage eleven buyer main-flow operation strip UI', () => {
  it('adds a buyer main-flow operation strip for the seven demo pages', () => {
    const app = read('App.tsx');

    expect(app).toContain('const buyerMainFlowOperationStrips: Partial<Record<BuyerAdminModule, BuyerMainFlowOperationStripConfig>>');
    expect(app).toContain('const BuyerMainFlowOperationStrip');
    expect(app).toContain('data-testid="stage11-buyer-main-flow-operation-strip"');
    expect(app).toContain('采购方主流程操作条');
    expect(app).toContain('当前页讲解重点');
    expect(app).toContain('推荐点击动作');
    expect(app).toContain('不可操作边界');
    expect(app).toContain('下一页承接');
  });

  it('covers demands, approvals, rfqs, quotes, orders, receipts, and invoices', () => {
    const app = read('App.tsx');

    expect(app).toContain("demands: {");
    expect(app).toContain("pageLabel: '采购需求'");
    expect(app).toContain("recommendedAction: '提交审批或创建询价'");
    expect(app).toContain("approvals: {");
    expect(app).toContain("pageLabel: '审批中心'");
    expect(app).toContain("recommendedAction: '通过或驳回待办'");
    expect(app).toContain("rfqs: {");
    expect(app).toContain("pageLabel: '询价项目'");
    expect(app).toContain("recommendedAction: '邀请供应商并进入报价对比'");
    expect(app).toContain("quotes: {");
    expect(app).toContain("pageLabel: '报价对比'");
    expect(app).toContain("recommendedAction: '提交定标审批或生成采购订单'");
    expect(app).toContain("orders: {");
    expect(app).toContain("pageLabel: '采购订单'");
    expect(app).toContain("recommendedAction: '跟进供应商确认和发货'");
    expect(app).toContain("receipts: {");
    expect(app).toContain("pageLabel: '收货验收'");
    expect(app).toContain("recommendedAction: '登记收货或说明异常'");
    expect(app).toContain("invoices: {");
    expect(app).toContain("pageLabel: '发票付款'");
    expect(app).toContain("recommendedAction: '处理对账差异并登记付款'");
  });

  it('records the first stage-eleven increment and keeps the product-demo-first boundary', () => {
    const path = 'docs/stage-eleven-execution-checklist.md';

    expect(existsSync(path)).toBe(true);

    const checklist = read(path);

    expect(checklist).toContain('# 阶段十一执行清单');
    expect(checklist).toContain('| 1 | 采购方主流程操作条 |');
    expect(checklist).toContain('stage11-buyer-main-flow-operation-strip');
    expect(checklist).toContain('不新增 Java API');
    expect(checklist).toContain('| 2 | 采购方主流程页面一致性 polish |');
    expect(checklist).toContain('| 3 | 采购方主流程视觉密度和移动端验收 |');
    expect(checklist).toContain('| 4 | 采购方主流程移动端密度修补 |');
    expect(checklist).toContain('下一轮建议：进入阶段十二');
  });
});
