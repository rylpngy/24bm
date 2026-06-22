import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven three-role demo acceptance package', () => {
  it('combines buyer supplier and platform real-click acceptance artifacts', () => {
    const artifactPath = 'docs/artifacts/stage-seven-onsite-demo-acceptance-result.json';

    expect(existsSync(artifactPath)).toBe(true);

    const artifact = JSON.parse(read(artifactPath)) as {
      dataSource: string;
      totalActions: number;
      failedTotal: number;
      buyer: { actionCount: number; failedCount: number; artifactPath: string };
      supplier: { actionCount: number; failedCount: number; artifactPath: string };
      platform: { actionCount: number; failedCount: number; artifactPath: string };
      scriptRuns: Array<{ scriptPath: string; status: number }>;
    };

    expect(artifact.dataSource).toBe('Java 数据源');
    expect(artifact.totalActions).toBe(17);
    expect(artifact.failedTotal).toBe(0);
    expect(artifact.buyer).toMatchObject({
      actionCount: 7,
      failedCount: 0,
      artifactPath: 'docs/artifacts/stage-seven-java-real-action-click-result.json',
    });
    expect(artifact.supplier).toMatchObject({
      actionCount: 5,
      failedCount: 0,
      artifactPath: 'docs/artifacts/stage-seven-supplier-java-real-action-click-result.json',
    });
    expect(artifact.platform).toMatchObject({
      actionCount: 5,
      failedCount: 0,
      artifactPath: 'docs/artifacts/stage-seven-platform-java-real-action-click-result.json',
    });
    expect(artifact.scriptRuns.map((run) => run.scriptPath)).toEqual([
      'scripts/stage-seven-real-action-click-check.mjs',
      'scripts/stage-seven-supplier-real-action-click-check.mjs',
      'scripts/stage-seven-platform-real-action-click-check.mjs',
    ]);
  });

  it('updates the onsite demo package documentation for three roles', () => {
    const packageDoc = read('docs/stage-seven-onsite-demo-acceptance-package.md');

    expect(packageDoc).toContain('采购方 7 个真实点击动作');
    expect(packageDoc).toContain('供应商 5 个真实点击动作');
    expect(packageDoc).toContain('平台端 5 个真实点击动作');
    expect(packageDoc).toContain('三端合计 `17` 个真实点击动作');
    expect(packageDoc).toContain('docs/stage-seven-platform-demo-runbook.md');
    expect(packageDoc).toContain('stage-seven-platform-java-real-action-click-result.json');
    expect(packageDoc).toContain('不声明平台套餐计费、用量统计、公共供应商市场已经完成');
  });

  it('records the twenty-seventh stage-seven increment as the three-role onsite package', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');
    const script = read('scripts/stage-seven-onsite-demo-acceptance-check.mjs');

    expect(checklist).toContain('| 27 | 三端现场演示总验收包 |');
    expect(checklist).toContain('采购方 7 个、供应商 5 个、平台端 5 个真实点击动作');
    expect(script).toContain('stage-seven-platform-real-action-click-check.mjs');
    expect(script).toContain('stage-seven-platform-java-real-action-click-result.json');
  });
});
