import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven order receipt invoice demo-first UI', () => {
  it('adds an order fulfillment demo panel that explains the award-to-order handoff', () => {
    const app = read('App.tsx');

    expect(app).toContain('订单履约演示台');
    expect(app).toContain('演示路径：从定标审批通过生成订单，跟进供应商确认、发货和预计到货，再进入收货验收。');
    expect(app).toContain('待生成订单');
    expect(app).toContain('待供应商确认');
    expect(app).toContain('待发货');
    expect(app).toContain('进入收货验收');
  });

  it('adds a receipt acceptance demo panel that explains delivery-to-invoice readiness', () => {
    const app = read('App.tsx');

    expect(app).toContain('收货验收演示台');
    expect(app).toContain('演示路径：供应商发货后登记收货验收，异常先记录原因，验收完成后进入发票付款。');
    expect(app).toContain('待收货');
    expect(app).toContain('可登记验收');
    expect(app).toContain('异常待处理');
    expect(app).toContain('进入发票付款');
  });

  it('adds an invoice payment demo panel that explains reconciliation and payment status', () => {
    const app = read('App.tsx');

    expect(app).toContain('发票付款演示台');
    expect(app).toContain('演示路径：供应商提交发票后完成对账，处理差异和付款计划，最后登记付款状态。');
    expect(app).toContain('待开票');
    expect(app).toContain('待对账');
    expect(app).toContain('差异待处理');
    expect(app).toContain('主流程演示闭环');
  });

  it('records the fifth stage-seven increment as fulfillment demo polish', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(checklist).toContain('| 5 | 采购订单、收货验收与发票付款演示体验第一轮 |');
    expect(checklist).toContain('订单履约演示台');
    expect(checklist).toContain('收货验收演示台');
    expect(checklist).toContain('发票付款演示台');
    expect(checklist).toContain('scripts/stage-seven-fulfillment-demo-ui.test.ts');
    expect(checklist).toContain('供应商侧协同演示补强');
  });
});
