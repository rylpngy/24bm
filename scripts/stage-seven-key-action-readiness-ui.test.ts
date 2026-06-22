import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven buyer key action readiness UI', () => {
  it('adds a shared key action readiness panel for demo operations', () => {
    const app = read('App.tsx');

    expect(app).toContain('const BuyerKeyActionReadinessPanel');
    expect(app).toContain('关键操作可用性');
    expect(app).toContain('当前数据下不可直接操作');
    expect(app).toContain('边界提示可解释');
    expect(app).toContain('可直接演示');
    expect(app).toContain('<BuyerKeyActionReadinessPanel');
    expect(app).toContain('actions={demoKeyActionReadiness}');
  });

  it('keeps the seven buyer main-flow actions visible even when unavailable', () => {
    const app = read('App.tsx');

    expect(app).toContain('const demoKeyActionReadiness = {');
    expect(app).toContain("label: '提交审批'");
    expect(app).toContain("label: '通过'");
    expect(app).toContain("label: '创建询价'");
    expect(app).toContain("label: '按推荐报价提交定标审批'");
    expect(app).toContain("label: '生成采购订单'");
    expect(app).toContain("label: '登记收货'");
    expect(app).toContain("label: '登记付款'");
    expect(app).toContain("enabled: workspace.demands.some((demand) => demand.status === '草稿')");
    expect(app).toContain('enabled: filteredApprovalQueueRows.length > 0');
    expect(app).toContain('enabled: demandToRfqReadyCount > 0');
    expect(app).toContain('enabled: quoteAwardSubmittableRfqCount > 0');
    expect(app).toContain('enabled: orderPendingGenerationCount > 0');
    expect(app).toContain('enabled: receiptReadyForInspectionCount > 0');
    expect(app).toContain('enabled: invoicePendingPaymentCount > 0');
  });

  it('records the twelfth stage-seven increment as buyer key action readiness polish', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(checklist).toContain('| 12 | 采购方关键操作可用性提示第一轮 |');
    expect(checklist).toContain('docs/artifacts/stage-seven-buyer-key-action-usability-result.json');
    expect(checklist).toContain('scripts/stage-seven-key-action-readiness-ui.test.ts');
  });

  it('keeps the Java browser key action usability recheck passing', () => {
    const artifact = JSON.parse(read('docs/artifacts/stage-seven-buyer-key-action-usability-result.json')) as {
      failed: unknown[];
      results: unknown[];
      dataSource: string;
    };

    expect(artifact.dataSource).toBe('Java 数据源');
    expect(artifact.results).toHaveLength(14);
    expect(artifact.failed).toHaveLength(0);
  });

  it('keeps the Java browser key action focus click recheck passing', () => {
    const artifact = JSON.parse(read('docs/artifacts/stage-seven-buyer-key-action-focus-result.json')) as {
      failed: unknown[];
      results: unknown[];
      dataSource: string;
    };

    expect(artifact.dataSource).toBe('Java 数据源');
    expect(artifact.results).toHaveLength(4);
    expect(artifact.failed).toHaveLength(0);
  });

  it('lets available readiness actions locate the real business action area instead of becoming no-op buttons', () => {
    const app = read('App.tsx');

    expect(app).toContain('const focusBuyerKeyAction = (actionLabel: string) => {');
    expect(app).toContain('已定位关键操作：${actionLabel}');
    expect(app).toContain("document.querySelector('[data-buyer-action-anchor=\"primary-business-action\"]')");
    expect(app).toContain('onFocusBuyerKeyAction={focusBuyerKeyAction}');
    expect(app).toContain('onActionFocus={onFocusBuyerKeyAction}');
    expect(app).toContain('onClick={() => onActionFocus(action.label)}');
    expect(app).toContain('定位真实操作区');
    expect(app).toContain('data-buyer-action-anchor="primary-business-action"');
  });

  it('records the thirteenth stage-seven increment as buyer key action focus polish', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(checklist).toContain('| 13 | 采购方关键操作定位第一轮 |');
    expect(checklist).toContain('定位真实操作区');
    expect(checklist).toContain('docs/artifacts/stage-seven-buyer-key-action-focus-result.json');
    expect(checklist).toContain('供应商侧协同演示补强');
  });

  it('keeps the local demo shell free from external font requests', () => {
    const html = read('index.html');

    expect(html).not.toContain('fonts.googleapis.com');
  });
});
