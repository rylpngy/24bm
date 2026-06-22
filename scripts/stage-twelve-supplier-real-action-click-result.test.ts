import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage twelve supplier real action click result', () => {
  it('records the supplier real-action browser click recheck', () => {
    const path = 'docs/stage-twelve-supplier-real-action-click-result.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十二供应商真实动作浏览器点击复验结果');
    expect(doc).toContain('Java 数据源');
    expect(doc).toContain('提交报价、确认订单、提交发货、提交发票、保存对账备注');
    expect(doc).toContain('docs/artifacts/stage-seven-supplier-java-real-action-click-result.json');
    expect(doc).toContain('attemptedRealClick');
    expect(doc).toContain('successVisible');
    expect(doc).toContain('失败项：0');
  });

  it('keeps the referenced browser click artifact green for five supplier actions', () => {
    const artifact = JSON.parse(read('docs/artifacts/stage-seven-supplier-java-real-action-click-result.json')) as {
      dataSource: string;
      failed: unknown[];
      results: Array<{
        action: string;
        attemptedRealClick: boolean;
        successVisible: boolean;
      }>;
    };

    expect(artifact.dataSource).toBe('Java 数据源');
    expect(artifact.failed).toHaveLength(0);
    expect(artifact.results).toHaveLength(5);
    expect(artifact.results.map((result) => result.action)).toEqual([
      '提交报价',
      '确认订单',
      '提交发货',
      '提交发票',
      '保存对账备注',
    ]);
    expect(artifact.results.every((result) => result.attemptedRealClick && result.successVisible)).toBe(true);
  });

  it('records the fifth stage-twelve increment in the execution checklist', () => {
    const checklist = read('docs/stage-twelve-execution-checklist.md');

    expect(checklist).toContain('| 5 | 供应商真实动作浏览器点击复验 |');
    expect(checklist).toContain('提交报价、确认订单、提交发货、提交发票、保存对账备注');
    expect(checklist).toContain('scripts/stage-twelve-supplier-real-action-click-result.test.ts');
    expect(checklist).toContain('下一轮建议：供应商协同收口验收包');
  });
});
