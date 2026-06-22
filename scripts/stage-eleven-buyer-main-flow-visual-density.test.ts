import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage eleven buyer main-flow visual density check', () => {
  it('defines a Java visual density script for all buyer main-flow pages', () => {
    const script = read('scripts/stage-eleven-buyer-main-flow-visual-density-check.mjs');

    expect(script).toContain('stage-eleven-buyer-main-flow-visual-density-result.json');
    expect(script).toContain('stage-eleven-buyer-main-flow-visual-density-result.md');
    expect(script).toContain('采购需求');
    expect(script).toContain('审批中心');
    expect(script).toContain('询价项目');
    expect(script).toContain('报价对比');
    expect(script).toContain('采购订单');
    expect(script).toContain('收货验收');
    expect(script).toContain('发票付款');
    expect(script).toContain('stage11-buyer-main-flow-operation-strip');
    expect(script).toContain('stage11-buyer-first-screen-focus');
    expect(script).toContain('stage11-buyer-action-visibility');
    expect(script).toContain('stage11-buyer-demo-data-slimming');
    expect(script).toContain('页面一致性检查');
    expect(script).toContain('首屏业务焦点');
    expect(script).toContain('动作区可见性');
    expect(script).toContain('演示数据瘦身');
    expect(script).toContain('desktop-1280x720');
    expect(script).toContain('mobile-390x844');
    expect(script).toContain('hasWholePageHorizontalOverflow');
    expect(script).toContain('Page.captureScreenshot');
  });

  it('keeps desktop and mobile visual evidence for the seven buyer main-flow pages', () => {
    const artifactPath = 'docs/artifacts/stage-eleven-buyer-main-flow-visual-density-result.json';

    expect(existsSync(artifactPath)).toBe(true);

    const artifact = JSON.parse(read(artifactPath)) as {
      dataSource: string;
      failed: unknown[];
      results: Array<{
        module: string;
        viewport: string;
        screenshotPath: string;
        metrics: {
          hasJavaDataSource: boolean;
          hasOperationStrip: boolean;
          hasFirstScreenFocus: boolean;
          hasActionVisibility: boolean;
          hasDemoDataSlimming: boolean;
          hasPageConsistencyCheck: boolean;
          hasLoadFailure: boolean;
          hasArgumentTypeMismatch: boolean;
          hasReactRuntimeError: boolean;
          hasWholePageHorizontalOverflow: boolean;
        };
        consoleErrors: unknown[];
      }>;
    };

    expect(artifact.dataSource).toBe('Java 数据源');
    expect(artifact.failed).toHaveLength(0);
    expect(artifact.results).toHaveLength(14);
    expect(artifact.results.map((result) => `${result.module}:${result.viewport}`)).toEqual([
      'demands:desktop-1280x720',
      'demands:mobile-390x844',
      'approvals:desktop-1280x720',
      'approvals:mobile-390x844',
      'rfqs:desktop-1280x720',
      'rfqs:mobile-390x844',
      'quotes:desktop-1280x720',
      'quotes:mobile-390x844',
      'orders:desktop-1280x720',
      'orders:mobile-390x844',
      'receipts:desktop-1280x720',
      'receipts:mobile-390x844',
      'invoices:desktop-1280x720',
      'invoices:mobile-390x844',
    ]);

    artifact.results.forEach((result) => {
      expect(existsSync(result.screenshotPath)).toBe(true);
      expect(result.metrics).toMatchObject({
        hasJavaDataSource: true,
        hasOperationStrip: true,
        hasFirstScreenFocus: true,
        hasActionVisibility: true,
        hasDemoDataSlimming: true,
        hasPageConsistencyCheck: true,
        hasLoadFailure: false,
        hasArgumentTypeMismatch: false,
        hasReactRuntimeError: false,
        hasWholePageHorizontalOverflow: false,
      });
      expect(result.consoleErrors).toHaveLength(0);
    });
  });

  it('documents the visual density result and records the third stage-eleven increment', () => {
    const doc = read('docs/stage-eleven-buyer-main-flow-visual-density-result.md');
    const checklist = read('docs/stage-eleven-execution-checklist.md');

    expect(doc).toContain('# 阶段十一采购方主流程视觉密度验收');
    expect(doc).toContain('node scripts/stage-eleven-buyer-main-flow-visual-density-check.mjs');
    expect(doc).toContain('desktop-1280x720');
    expect(doc).toContain('mobile-390x844');
    expect(doc).toContain('7 个采购方主流程页面');
    expect(doc).toContain('阶段十一操作条可见');
    expect(doc).toContain('首屏业务焦点可见');
    expect(doc).toContain('动作区可见性可见');
    expect(doc).toContain('演示数据瘦身可见');
    expect(doc).toContain('无整页横向溢出');

    expect(checklist).toContain('| 3 | 采购方主流程视觉密度和移动端验收 |');
    expect(checklist).toContain('stage-eleven-buyer-main-flow-visual-density-result.json');
    expect(checklist).toContain('桌面/移动截图');
  });
});
