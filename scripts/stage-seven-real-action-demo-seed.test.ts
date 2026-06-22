import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven Java real action demo seed', () => {
  it('adds local Java demo fixtures for every real-click breakpoint', () => {
    const seed = read('backend-java/src/main/resources/db/dev/V120__stage_seven_real_action_demo_seed.sql');

    expect(seed).toContain('dem-stage7-submit-ready');
    expect(seed).toContain("'草稿'");
    expect(seed).toContain('dem-stage7-approval-pending');
    expect(seed).toContain("'审批中'");
    expect(seed).toContain('approval-stage7-demand-pending');
    expect(seed).toContain("'待审批'");
    expect(seed).toContain('dem-stage7-rfq-ready');
    expect(seed).toContain("'已通过'");
    expect(seed).toContain('rfq-stage7-award-ready');
    expect(seed).toContain("'报价中'");
    expect(seed).toContain('award-stage7-order-ready');
    expect(seed).toContain('approval-stage7-award-approved');
    expect(seed).toContain("'已通过'");
    expect(seed).toContain('po-stage7-receipt-ready');
    expect(seed).toContain("'已发货'");
    expect(seed).toContain('delivery-stage7-receipt-ready');
    expect(seed).toContain('inv-stage7-payment-ready');
    expect(seed).toContain("'待付款'");
  });

  it('records the fifteenth stage-seven increment as real-click breakpoint seed repair', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(checklist).toContain('| 15 | Java 主流程真实点击断点修复第一轮 |');
    expect(checklist).toContain('backend-java/src/main/resources/db/dev/V120__stage_seven_real_action_demo_seed.sql');
    expect(checklist).toContain('scripts/stage-seven-real-action-demo-seed.test.ts');
    expect(checklist).toContain('| 17 | Java 主流程付款登记真实点击补齐 |');
  });

  it('adds stable action hooks and a repeatable Chrome walkthrough for the Java real-click demo', () => {
    const app = read('App.tsx');
    const walkthrough = read('scripts/stage-seven-real-action-click-check.mjs');

    [
      'stage7-submit-demand-${demand.id}',
      'stage7-create-rfq-${demand.id}',
      'stage7-approve-${approvalId}',
      'stage7-submit-award-${rfq.id}',
      'stage7-create-order-${approvedAwardId}',
      'stage7-create-receipt-${orderId}',
    ].forEach((hook) => expect(app).toContain(hook));

    expect(walkthrough).toContain('V120__stage_seven_real_action_demo_seed.sql');
    expect(walkthrough).toContain('stage7-submit-demand-dem-stage7-submit-ready');
    expect(walkthrough).toContain('stage7-approve-approval-stage7-demand-pending');
    expect(walkthrough).toContain('stage7-create-rfq-dem-stage7-rfq-ready');
    expect(walkthrough).toContain('stage7-submit-award-rfq-stage7-award-ready');
    expect(walkthrough).toContain('stage7-create-order-award-stage7-order-ready');
    expect(walkthrough).toContain('stage7-create-receipt-po-stage7-receipt-ready');
    expect(walkthrough).toContain('stage7-register-payment-inv-stage7-payment-ready');
  });
});
