import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage eleven buyer main-flow mobile density polish', () => {
  it('compresses the stage-eleven operation strip for mobile reading', () => {
    const app = read('App.tsx');

    expect(app).toContain('stage11-buyer-main-flow-operation-strip--compact');
    expect(app).toContain('grid-cols-2');
    expect(app).toContain('sm:grid-cols-2');
    expect(app).toContain('xl:grid-cols-4');
    expect(app).toContain('hidden');
    expect(app).toContain('sm:block');
    expect(app).toContain('p-2 sm:p-3');
    expect(app).toContain('text-[10px]');
  });

  it('keeps mobile operation strip height below the demo-first threshold', () => {
    const artifact = JSON.parse(read('docs/artifacts/stage-eleven-buyer-main-flow-visual-density-result.json')) as {
      failed: unknown[];
      results: Array<{
        module: string;
        viewport: string;
        metrics: {
          operationStripHeight: number | null;
          measurementMode?: string;
          hasWholePageHorizontalOverflow: boolean;
        };
      }>;
    };

    const mobileResults = artifact.results.filter((result) => result.viewport === 'mobile-390x844');

    expect(artifact.failed).toHaveLength(0);
    expect(mobileResults).toHaveLength(7);
    mobileResults.forEach((result) => {
      expect(result.metrics.hasWholePageHorizontalOverflow).toBe(false);
      if (typeof result.metrics.operationStripHeight === 'number') {
        expect(result.metrics.operationStripHeight).toBeLessThanOrEqual(640);
      } else {
        expect(result.metrics.measurementMode).toBe('chrome-cli-dom-screenshot');
      }
    });
  });

  it('records the fourth stage-eleven increment as mobile density polish', () => {
    const checklist = read('docs/stage-eleven-execution-checklist.md');

    expect(checklist).toContain('| 4 | 采购方主流程移动端密度修补 |');
    expect(checklist).toContain('移动端操作条高度');
    expect(checklist).toContain('scripts/stage-eleven-buyer-main-flow-mobile-density-polish.test.ts');
    expect(checklist).toContain('下一轮建议：进入阶段十二');
  });
});
