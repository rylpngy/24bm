import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage six post-order readonly UI boundary', () => {
  it('models locked, awarded, and not-selected quote statuses in the frontend domain', () => {
    const model = read('data/procurementModel.ts');

    expect(model).toContain("'已锁定'");
    expect(model).toContain("'已中选'");
    expect(model).toContain("'未中选'");
    expect(model).toContain("status: '已中选'");
    expect(model).toContain("status: '未中选'");
  });

  it('surfaces post-order RFQ and quote readonly guidance in buyer workflow and operation panels', () => {
    const workflow = read('data/buyerWorkflow.ts');
    const app = read('App.tsx');

    expect(workflow).toContain('订单已生成');
    expect(workflow).toContain('RFQ 和报价进入只读跟踪');
    expect(app).toContain('订单已生成，RFQ 和报价进入只读跟踪');
    expect(app).toContain('该询价项目已生成采购订单，定标结果和报价状态不可再变更');
    expect(app).toContain('可在采购订单、收货验收和发票付款中继续履约。');
  });

  it('shows quote status badges after award closeout', () => {
    const app = read('App.tsx');
    const rfqCard = app.slice(
      app.indexOf('const RfqCard'),
      app.indexOf('const AdminInfoCard'),
    );

    expect(rfqCard).toContain('quote.status');
    expect(rfqCard).toContain('已中选');
    expect(rfqCard).toContain('未中选');
    expect(rfqCard).toContain('报价状态');
  });

  it('records the thirteenth stage-six increment in the execution checklist', () => {
    const checklist = read('docs/stage-six-execution-checklist.md');

    expect(checklist).toContain('| 13 | 订单生成后的 RFQ/报价只读提示和前端操作边界 |');
    expect(checklist).toContain('订单已生成后，RFQ 和报价进入只读跟踪');
    expect(checklist).toContain('展示 `已中选`、`未中选`、`已锁定` 报价状态');
    expect(checklist).toContain('scripts/stage-six-post-order-readonly-ui.test.ts');
    expect(checklist).toContain('阶段七建议入口：优先做 Java 模式真实演示闭环、页面细节修复和主流程演示路径固化');
  });
});
