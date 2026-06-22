import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage nine onsite visual acceptance package', () => {
  it('defines a stage-nine Java visual replay script for all three demo roles', () => {
    const script = read('scripts/stage-nine-onsite-visual-acceptance-check.mjs');

    expect(script).toContain('stage-nine-onsite-visual-acceptance-result.json');
    expect(script).toContain('stage-nine-onsite-visual-acceptance-result.md');
    expect(script).toContain('采购方阶段九演示入口');
    expect(script).toContain('供应商阶段九演示入口');
    expect(script).toContain('平台端阶段九演示入口');
    expect(script).toContain('演示准备检查');
    expect(script).toContain('stage9-demo-readiness-panel');
    expect(script).toContain('Page.captureScreenshot');
    expect(script).toContain('hasWholePageHorizontalOverflow');
  });

  it('keeps desktop and mobile Java visual evidence for buyer, supplier, and platform stage-nine entrypoints', () => {
    const artifactPath = 'docs/artifacts/stage-nine-onsite-visual-acceptance-result.json';

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
          hasDemoReadinessPanel: boolean;
          hasDemoCommandCenter: boolean;
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
    expect(artifact.results).toHaveLength(6);
    expect(artifact.results.map((result) => `${result.role}:${result.module}:${result.viewport}`)).toEqual([
      'buyer:demands:desktop-1280x720',
      'buyer:demands:mobile-390x844',
      'supplier:opportunities:desktop-1280x720',
      'supplier:opportunities:mobile-390x844',
      'platform:tenants:desktop-1280x720',
      'platform:tenants:mobile-390x844',
    ]);

    artifact.results.forEach((result) => {
      expect(existsSync(result.screenshotPath)).toBe(true);
      expect(result.metrics).toMatchObject({
        hasJavaDataSource: true,
        hasDemoReadinessPanel: true,
        hasDemoCommandCenter: true,
        hasLoadFailure: false,
        hasArgumentTypeMismatch: false,
        hasReactRuntimeError: false,
        hasWholePageHorizontalOverflow: false,
      });
      expect(result.consoleErrors).toHaveLength(0);
    });
  });

  it('documents the stage-nine visual replay workflow and checklist increment', () => {
    const doc = read('docs/stage-nine-onsite-visual-acceptance-result.md');
    const checklist = read('docs/stage-nine-execution-checklist.md');

    expect(doc).toContain('# 阶段九现场视觉复跑结果');
    expect(doc).toContain('node scripts/stage-nine-onsite-visual-acceptance-check.mjs');
    expect(doc).toContain('desktop-1280x720');
    expect(doc).toContain('mobile-390x844');
    expect(doc).toContain('采购方阶段九演示入口');
    expect(doc).toContain('供应商阶段九演示入口');
    expect(doc).toContain('平台端阶段九演示入口');
    expect(doc).toContain('演示准备检查面板可见');
    expect(doc).toContain('控制台 error 为 0');

    expect(checklist).toContain('| 9 | 阶段九现场视觉截图复跑 |');
    expect(checklist).toContain('stage-nine-onsite-visual-acceptance-result.json');
    expect(checklist).toContain('采购方、供应商、平台端的桌面/移动截图');
  });
});
