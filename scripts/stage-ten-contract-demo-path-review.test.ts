import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage ten contract demo path review', () => {
  it('defines a Java visual check for the contract order handoff demo path', () => {
    const script = read('scripts/stage-ten-contract-demo-path-check.mjs');

    expect(script).toContain('stage-ten-contract-demo-path-result.json');
    expect(script).toContain('stage-ten-contract-demo-path-review.md');
    expect(script).toContain('role=buyer&module=orders');
    expect(script).toContain('role=buyer&module=contracts');
    expect(script).toContain('role=buyer&module=approvals');
    expect(script).toContain('role=buyer&module=receipts');
    expect(script).toContain('role=buyer&module=invoices');
    expect(script).toContain('订单生成合同');
    expect(script).toContain('合同审批');
    expect(script).toContain('合同履约事件');
    expect(script).toContain('合同与订单/发票/付款关系');
  });

  it('keeps reviewed Java evidence for all five contract handoff pages', () => {
    const artifactPath = 'docs/artifacts/stage-ten-contract-demo-path-result.json';

    expect(existsSync(artifactPath)).toBe(true);

    const artifact = JSON.parse(read(artifactPath)) as {
      dataSource: string;
      failed: unknown[];
      results: Array<{
        id: string;
        label: string;
        checks: {
          hasJavaDataSource: boolean;
          hasLoadFailure: boolean;
          hasArgumentTypeMismatch: boolean;
          hasReactRuntimeError: boolean;
        };
        captures: Array<{ screenshotPath: string; screenshotWritten: boolean }>;
      }>;
    };

    expect(artifact.dataSource).toBe('Java 数据源');
    expect(artifact.failed).toHaveLength(0);
    expect(artifact.results.map((result) => result.id)).toEqual([
      'orders',
      'contracts',
      'approvals',
      'receipts',
      'invoices',
    ]);

    artifact.results.forEach((result) => {
      expect(result.checks).toMatchObject({
        hasJavaDataSource: true,
        hasLoadFailure: false,
        hasArgumentTypeMismatch: false,
        hasReactRuntimeError: false,
      });
      result.captures.forEach((capture) => {
        expect(capture.screenshotWritten).toBe(true);
        expect(existsSync(capture.screenshotPath)).toBe(true);
      });
    });
  });

  it('documents the review result and records the second stage-ten increment', () => {
    const doc = read('docs/stage-ten-contract-demo-path-review.md');
    const checklist = read('docs/stage-ten-execution-checklist.md');

    expect(doc).toContain('# 阶段十合同演示路径复核');
    expect(doc).toContain('采购订单');
    expect(doc).toContain('合同管理');
    expect(doc).toContain('审批中心');
    expect(doc).toContain('收货验收');
    expect(doc).toContain('发票付款');
    expect(doc).toContain('无加载失败');
    expect(doc).toContain('无 `argument type mismatch`');
    expect(doc).toContain('无 React runtime error');
    expect(doc).toContain('订单生成合同');
    expect(doc).toContain('合同审批');
    expect(doc).toContain('合同履约事件');
    expect(doc).toContain('合同与订单/发票/付款关系');

    expect(checklist).toContain('| 2 | 合同演示路径复核 |');
    expect(checklist).toContain('scripts/stage-ten-contract-demo-path-check.mjs');
    expect(checklist).toContain('docs/stage-ten-contract-demo-path-review.md');
    expect(checklist).toContain('| 3 | 合同演示总线和推荐样本 |');
    expect(checklist).toContain('| 4 | 合同演示动作闭环 |');
    expect(checklist).toContain('| 5 | 合同现场讲解脚本和 Java 视觉复跑 |');
    expect(checklist).toContain('| 6 | 阶段十合同演示收口复盘 |');
    expect(checklist).toContain('下一轮建议：回到采购主流程 polish');
  });
});
