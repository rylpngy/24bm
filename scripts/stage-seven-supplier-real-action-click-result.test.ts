import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven supplier Java real business action click result', () => {
  it('keeps the supplier-side Java real business action walkthrough passing', () => {
    const artifact = JSON.parse(read('docs/artifacts/stage-seven-supplier-java-real-action-click-result.json')) as {
      dataSource: string;
      failed: unknown[];
      results: Array<{
        action: string;
        module: string;
        attemptedRealClick: boolean;
        successVisible: boolean;
        boundaryVisible: boolean;
        outcome: string;
      }>;
    };

    expect(artifact.dataSource).toBe('Java 数据源');
    expect(artifact.results).toHaveLength(5);
    expect(artifact.failed).toHaveLength(0);
    expect(artifact.results.map((result) => result.action)).toEqual([
      '提交报价',
      '确认订单',
      '提交发货',
      '提交发票',
      '保存对账备注',
    ]);
    expect(artifact.results.every((result) => result.attemptedRealClick && result.successVisible)).toBe(true);
    expect(artifact.results.every((result) => !result.boundaryVisible)).toBe(true);
  });

  it('records the twentieth stage-seven increment as supplier real-click fixture and script', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');
    const walkthrough = read('scripts/stage-seven-supplier-real-action-click-check.mjs');
    const seed = read('backend-java/src/main/resources/db/dev/V120__stage_seven_real_action_demo_seed.sql');

    expect(checklist).toContain('| 20 | 供应商侧真实点击 fixture 与脚本 |');
    expect(checklist).toContain('stage-seven-supplier-java-real-action-click-result.json');
    expect(checklist).toContain('提交报价、确认订单、提交发货、提交发票、应收对账备注 5 个动作');
    expect(walkthrough).toContain('stage7-supplier-submit-quote-rfq-stage7-supplier-quote-ready');
    expect(walkthrough).toContain('stage7-supplier-confirm-order-po-stage7-supplier-confirm-ready');
    expect(walkthrough).toContain('stage7-supplier-create-delivery-po-stage7-supplier-delivery-ready');
    expect(walkthrough).toContain('stage7-supplier-create-invoice-po-stage7-supplier-invoice-ready');
    expect(walkthrough).toContain('stage7-supplier-update-receivable-inv-stage7-supplier-receivable-ready');
    expect(seed).toContain('rfq-stage7-supplier-quote-ready');
    expect(seed).toContain('po-stage7-supplier-confirm-ready');
    expect(seed).toContain('po-stage7-supplier-delivery-ready');
    expect(seed).toContain('po-stage7-supplier-invoice-ready');
    expect(seed).toContain('inv-stage7-supplier-receivable-ready');
  });
});
