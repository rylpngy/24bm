import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven platform visual acceptance', () => {
  it('defines a Java platform visual acceptance script for the four platform modules', () => {
    const script = read('scripts/stage-seven-platform-visual-acceptance-check.mjs');

    expect(script).toContain('stage-seven-platform-visual-acceptance-result.json');
    expect(script).toContain('stage-seven-platform-visual-acceptance-result.md');
    expect(script).toContain('role=platform&module=overview');
    expect(script).toContain('role=platform&module=tenants');
    expect(script).toContain('role=platform&module=reviews');
    expect(script).toContain('role=platform&module=announcements');
    expect(script).toContain('平台运营演示路径');
    expect(script).toContain('Java 数据源');
    expect(script).toContain('--screenshot=');
    expect(script).toContain('--dump-dom');
  });

  it('writes a platform visual acceptance artifact with screenshots and no failed checks', () => {
    const artifactPath = 'docs/artifacts/stage-seven-platform-visual-acceptance-result.json';
    expect(existsSync(artifactPath)).toBe(true);

    const artifact = JSON.parse(read(artifactPath)) as {
      dataSource: string;
      results: Array<{
        module: string;
        screenshotPath: string;
        failures: string[];
        metrics: {
          hasJavaDataSource: boolean;
          hasLoadFailure: boolean;
          hasArgumentTypeMismatch: boolean;
          hasReactRuntimeError: boolean;
          requiredText: Record<string, boolean>;
        };
      }>;
      failed: unknown[];
    };

    expect(artifact.dataSource).toBe('Java');
    expect(artifact.results.map((result) => result.module)).toEqual([
      'overview',
      'tenants',
      'reviews',
      'announcements',
    ]);
    expect(artifact.failed).toHaveLength(0);
    for (const result of artifact.results) {
      expect(existsSync(result.screenshotPath)).toBe(true);
      expect(result.failures).toHaveLength(0);
      expect(result.metrics.hasJavaDataSource).toBe(true);
      expect(result.metrics.hasLoadFailure).toBe(false);
      expect(result.metrics.hasArgumentTypeMismatch).toBe(false);
      expect(result.metrics.hasReactRuntimeError).toBe(false);
      expect(Object.values(result.metrics.requiredText).every(Boolean)).toBe(true);
    }
  });

  it('documents the platform visual acceptance result and stage checklist entry', () => {
    const doc = read('docs/stage-seven-platform-visual-acceptance-result.md');
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(doc).toContain('# 阶段七平台运营端视觉验收结果');
    expect(doc).toContain('node scripts/stage-seven-platform-visual-acceptance-check.mjs');
    expect(doc).toContain('平台看板、租户列表、企业审核、平台公告');
    expect(doc).toContain('失败项：0');
    expect(checklist).toContain('| 25 | 平台运营端 Java 视觉验收 |');
    expect(checklist).toContain('scripts/stage-seven-platform-visual-acceptance-check.mjs');
    expect(checklist).toContain('docs/stage-seven-platform-visual-acceptance-result.md');
  });
});
