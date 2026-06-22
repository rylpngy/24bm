import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer module header and toolbar UI', () => {
  it('adds a shared buyer module header to core buyer workspace pages', () => {
    const app = read('App.tsx');

    expect(app).toContain('const BuyerModuleHeader');
    expect(app).toContain('const buyerModuleHeaders: Record<BuyerAdminModule');
    expect(app).toContain('const moduleHeader = buyerModuleHeaders[activeModule]');
    expect(app).toContain('<BuyerModuleHeader header={moduleHeader}');
    expect(app).toContain('本页关键动作');
    expect(app).toContain('当前筛选');
    expect(app.match(/<BuyerModuleHeader header=/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it('surfaces module-specific buyer page copy for demand, approval, rfq, order, receipt, and invoice pages', () => {
    const app = read('App.tsx');

    expect(app).toContain("demands: {");
    expect(app).toContain("title: '采购需求'");
    expect(app).toContain("primaryAction: '新建需求 / 提交审批'");
    expect(app).toContain("approvals: {");
    expect(app).toContain("primaryAction: '通过 / 驳回审批'");
    expect(app).toContain("rfqs: {");
    expect(app).toContain("primaryAction: '邀请供应商 / 跟进报价'");
    expect(app).toContain("orders: {");
    expect(app).toContain("primaryAction: '生成订单 / 跟进确认'");
    expect(app).toContain("receipts: {");
    expect(app).toContain("primaryAction: '登记收货验收'");
    expect(app).toContain("invoices: {");
    expect(app).toContain("primaryAction: '登记付款状态'");
  });
});
