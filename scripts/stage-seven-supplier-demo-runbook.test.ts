import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven supplier demo runbook', () => {
  it('documents the supplier-side collaboration demo path and current evidence boundary', () => {
    const runbookPath = 'docs/stage-seven-supplier-demo-runbook.md';

    expect(existsSync(runbookPath)).toBe(true);

    const runbook = read(runbookPath);
    const requiredDemoSteps = [
      '询价邀请',
      '提交报价',
      '报价记录',
      '确认订单',
      '提交发货',
      '提交发票',
      '发票应收',
    ];

    expect(runbook).toContain('# 阶段七供应商侧协同演示脚本');
    expect(runbook).toContain('http://localhost:3000/?role=supplier&module=opportunities');
    expect(runbook).toContain('docs/stage-seven-buyer-demo-runbook.md');
    expect(runbook).toContain('/api/v1/supplier/rfqs');
    expect(runbook).toContain('/api/v1/supplier/rfqs/${rfqId}/quotes');
    expect(runbook).toContain('/api/v1/supplier/orders/${orderId}/confirm');
    expect(runbook).toContain('/api/v1/supplier/orders/${orderId}/deliveries');
    expect(runbook).toContain('/api/v1/supplier/orders/${orderId}/invoices');
    expect(runbook).toContain('本轮为供应商侧演示脚本第一轮，不声明供应商侧 5 个动作已经全部可重复真实点击');

    requiredDemoSteps.forEach((step) => {
      expect(runbook).toContain(step);
    });
  });

  it('records the nineteenth stage-seven increment as the supplier demo runbook', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(checklist).toContain('| 19 | 供应商侧协同演示脚本第一轮 |');
    expect(checklist).toContain('docs/stage-seven-supplier-demo-runbook.md');
    expect(checklist).toContain('scripts/stage-seven-supplier-demo-runbook.test.ts');
    expect(checklist).toContain('供应商侧真实点击 fixture 与脚本');
  });
});
