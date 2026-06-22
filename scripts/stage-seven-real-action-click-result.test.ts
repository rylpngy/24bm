import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven Java real business action click result', () => {
  it('keeps the Java real business action click or boundary walkthrough passing', () => {
    const artifact = JSON.parse(read('docs/artifacts/stage-seven-java-real-action-click-result.json')) as {
      dataSource: string;
      failed: unknown[];
      results: Array<{
        action: string;
        module: string;
        outcome: string;
        attemptedRealClick: boolean;
        successVisible: boolean;
        boundaryVisible: boolean;
      }>;
    };

    expect(artifact.dataSource).toBe('Java 数据源');
    expect(artifact.results).toHaveLength(7);
    expect(artifact.failed).toHaveLength(0);
    expect(artifact.results.map((result) => result.action)).toEqual([
      '提交审批',
      '通过',
      '创建询价',
      '按推荐报价提交定标审批',
      '生成采购订单',
      '登记收货',
      '登记付款',
    ]);
    expect(artifact.results.every((result) => result.attemptedRealClick || result.boundaryVisible)).toBe(true);
    expect(artifact.results.filter((result) => result.attemptedRealClick && result.successVisible)).toHaveLength(7);
    expect(artifact.results.find((result) => result.action === '登记付款')).toMatchObject({
      attemptedRealClick: true,
      successVisible: true,
      boundaryVisible: false,
    });
  });

  it('records the fourteenth stage-seven increment as Java real action click walkthrough', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(checklist).toContain('| 14 | Java 主流程真实点击演示复核第一轮 |');
    expect(checklist).toContain('docs/artifacts/stage-seven-java-real-action-click-result.json');
    expect(checklist).toContain('scripts/stage-seven-real-action-click-result.test.ts');
    expect(checklist).toContain('| 15 | Java 主流程真实点击断点修复第一轮 |');
  });

  it('records the sixteenth stage-seven increment as repeatable Java real-click recheck', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');
    const walkthrough = read('scripts/stage-seven-real-action-click-check.mjs');

    expect(checklist).toContain('| 16 | Java 主流程真实点击二次复核 |');
    expect(checklist).toContain('scripts/stage-seven-real-action-click-check.mjs');
    expect(checklist).toContain('提交审批、通过审批、创建询价、定标审批、生成采购订单、登记收货 6 个动作均真实点击成功');
    expect(checklist).toContain('| 17 | Java 主流程付款登记真实点击补齐 |');
    expect(walkthrough).toContain('Chrome CDP');
    expect(walkthrough).toContain('failed');
  });

  it('records the seventeenth stage-seven increment as full real-click demo closure', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');
    const walkthrough = read('scripts/stage-seven-real-action-click-check.mjs');

    expect(checklist).toContain('| 17 | Java 主流程付款登记真实点击补齐 |');
    expect(checklist).toContain('7 个采购方主流程动作均真实点击成功');
    expect(checklist).toContain('| 18 | 采购方完整现场演示脚本 |');
    expect(walkthrough).toContain('stage7-register-payment-inv-stage7-payment-ready');
  });
});
