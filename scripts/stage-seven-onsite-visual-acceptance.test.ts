import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven onsite visual acceptance package', () => {
  it('keeps desktop and mobile Java visual evidence for buyer and supplier demo entrypoints', () => {
    const artifactPath = 'docs/artifacts/stage-seven-onsite-visual-acceptance-result.json';

    expect(existsSync(artifactPath)).toBe(true);

    const artifact = JSON.parse(read(artifactPath)) as {
      dataSource: string;
      failed: unknown[];
      results: Array<{
        role: string;
        module: string;
        viewport: string;
        screenshotPath: string;
        metrics: {
          hasJavaDataSource: boolean;
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
    expect(artifact.results).toHaveLength(4);
    expect(artifact.results.map((result) => `${result.role}:${result.module}:${result.viewport}`)).toEqual([
      'buyer:demands:desktop-1280x720',
      'buyer:demands:mobile-390x844',
      'supplier:opportunities:desktop-1280x720',
      'supplier:opportunities:mobile-390x844',
    ]);

    artifact.results.forEach((result) => {
      expect(existsSync(result.screenshotPath)).toBe(true);
      expect(result.metrics).toMatchObject({
        hasJavaDataSource: true,
        hasLoadFailure: false,
        hasArgumentTypeMismatch: false,
        hasReactRuntimeError: false,
        hasWholePageHorizontalOverflow: false,
      });
      expect(result.consoleErrors).toHaveLength(0);
    });
  });

  it('documents the visual acceptance workflow and screenshots', () => {
    const docPath = 'docs/stage-seven-onsite-visual-acceptance-result.md';

    expect(existsSync(docPath)).toBe(true);

    const doc = read(docPath);

    expect(doc).toContain('# 阶段七现场视觉验收结果');
    expect(doc).toContain('node scripts/stage-seven-onsite-visual-acceptance-check.mjs');
    expect(doc).toContain('desktop-1280x720');
    expect(doc).toContain('mobile-390x844');
    expect(doc).toContain('采购方演示入口');
    expect(doc).toContain('供应商演示入口');
    expect(doc).toContain('无整页横向溢出');
    expect(doc).toContain('控制台 error 为 0');
  });

  it('records the twenty-second stage-seven increment as onsite visual acceptance', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');
    const script = read('scripts/stage-seven-onsite-visual-acceptance-check.mjs');

    expect(checklist).toContain('| 22 | 阶段七现场视觉验收包 |');
    expect(checklist).toContain('stage-seven-onsite-visual-acceptance-result.json');
    expect(checklist).toContain('采购方和供应商演示入口的桌面/移动截图、控制台错误和整页横向溢出检查');
    expect(script).toContain('stage-seven-onsite-visual-acceptance-result.json');
    expect(script).toContain('Page.captureScreenshot');
    expect(script).toContain('hasWholePageHorizontalOverflow');
  });
});
