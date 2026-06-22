import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage thirteen contract visual acceptance', () => {
  it('defines a focused Java visual acceptance script for the contract deepening page', () => {
    const scriptPath = 'scripts/stage-thirteen-contract-visual-acceptance-check.mjs';

    expect(existsSync(scriptPath)).toBe(true);

    const script = read(scriptPath);

    expect(script).toContain('stage-thirteen-contract-visual-acceptance-result.json');
    expect(script).toContain('stage-thirteen-contract-visual-acceptance-result.md');
    expect(script).toContain('stage13-contract-demo-readiness');
    expect(script).toContain('stage10-contract-demo-action-loop');
    expect(script).toContain('desktop-1280x720');
    expect(script).toContain('mobile-390x844');
    expect(script).toContain('hasWholePageHorizontalOverflow');
    expect(script).toContain('Page.captureScreenshot');
  });

  it('keeps desktop and mobile Java visual evidence for the stage-thirteen contract page', () => {
    const artifactPath = 'docs/artifacts/stage-thirteen-contract-visual-acceptance-result.json';

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
          hasStageThirteenReadinessPanel: boolean;
          hasContractActionLoop: boolean;
          hasRecommendedContractSample: boolean;
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
    expect(artifact.results).toHaveLength(2);
    expect(artifact.results.map((result) => `${result.module}:${result.viewport}`)).toEqual([
      'contracts:desktop-1280x720',
      'contracts:mobile-390x844',
    ]);

    artifact.results.forEach((result) => {
      expect(existsSync(result.screenshotPath)).toBe(true);
      expect(result.metrics).toMatchObject({
        hasJavaDataSource: true,
        hasStageThirteenReadinessPanel: true,
        hasContractActionLoop: true,
        hasRecommendedContractSample: true,
        hasLoadFailure: false,
        hasArgumentTypeMismatch: false,
        hasReactRuntimeError: false,
        hasWholePageHorizontalOverflow: false,
      });
      expect(result.consoleErrors).toHaveLength(0);
    });
  });

  it('documents the visual acceptance result and updates the stage-thirteen checklist', () => {
    const doc = read('docs/stage-thirteen-contract-visual-acceptance-result.md');
    const checklist = read('docs/stage-thirteen-execution-checklist.md');

    expect(doc).toContain('# 阶段十三合同深化浏览器视觉验收结果');
    expect(doc).toContain('node scripts/stage-thirteen-contract-visual-acceptance-check.mjs');
    expect(doc).toContain('desktop-1280x720');
    expect(doc).toContain('mobile-390x844');
    expect(doc).toContain('stage13-contract-demo-readiness');
    expect(doc).toContain('stage10-contract-demo-action-loop');
    expect(doc).toContain('失败项：0');
    expect(doc).toContain('控制台 error 为 0');
    expect(doc).toContain('无整页横向溢出');

    expect(checklist).toContain('| 3 | 合同深化浏览器视觉验收 |');
    expect(checklist).toContain('stage-thirteen-contract-visual-acceptance-result.json');
    expect(checklist).toContain('scripts/stage-thirteen-contract-visual-acceptance.test.ts');
    expect(checklist).toContain('下一轮建议：合同深化现场讲解脚本');
  });
});
