import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage twelve three-role demo closeout package', () => {
  it('records a three-role demo closeout package with buyer supplier and platform evidence', () => {
    const path = 'docs/stage-twelve-three-role-demo-closeout-package.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十二三端演示总收口验收包');
    expect(doc).toContain('采购方主流程演示收口');
    expect(doc).toContain('供应商协同收口验收包');
    expect(doc).toContain('平台运营端收口验收包');
    expect(doc).toContain('docs/stage-eleven-closeout-acceptance-package.md');
    expect(doc).toContain('docs/stage-twelve-supplier-closeout-acceptance-package.md');
    expect(doc).toContain('docs/stage-twelve-platform-closeout-acceptance-package.md');
  });

  it('states the three demo entrances sequence and real action proof', () => {
    const doc = read('docs/stage-twelve-three-role-demo-closeout-package.md');

    [
      '采购方入口：`http://localhost:3000/?role=buyer&module=demands`',
      '供应商入口：`http://localhost:3000/?role=supplier&module=opportunities`',
      '平台入口：`http://localhost:3000/?role=platform&module=tenants`',
      '采购方 7 个真实动作',
      '供应商 5 个真实动作',
      '平台端 5 个真实动作',
      '合计 17 个真实动作',
      'failedTotal = 0',
      'Java 数据源',
    ].forEach((copy) => {
      expect(doc).toContain(copy);
    });
  });

  it('keeps all referenced real action artifacts green', () => {
    const buyerArtifact = JSON.parse(read('docs/artifacts/stage-seven-java-real-action-click-result.json')) as {
      failed: unknown[];
      results: Array<{ attemptedRealClick: boolean; successVisible: boolean }>;
    };
    const supplierArtifact = JSON.parse(read('docs/artifacts/stage-seven-supplier-java-real-action-click-result.json')) as {
      failed: unknown[];
      results: Array<{ attemptedRealClick: boolean; successVisible: boolean }>;
    };
    const platformArtifact = JSON.parse(read('docs/artifacts/stage-seven-platform-java-real-action-click-result.json')) as {
      failed: number;
      passed: number;
      results: Array<{ passed: boolean }>;
    };

    expect(buyerArtifact.failed).toHaveLength(0);
    expect(buyerArtifact.results).toHaveLength(7);
    expect(buyerArtifact.results.every((result) => result.attemptedRealClick && result.successVisible)).toBe(true);
    expect(supplierArtifact.failed).toHaveLength(0);
    expect(supplierArtifact.results).toHaveLength(5);
    expect(supplierArtifact.results.every((result) => result.attemptedRealClick && result.successVisible)).toBe(true);
    expect(platformArtifact.failed).toBe(0);
    expect(platformArtifact.passed).toBe(5);
    expect(platformArtifact.results.every((result) => result.passed)).toBe(true);
  });

  it('records demo-ready boundaries and production gaps', () => {
    const doc = read('docs/stage-twelve-three-role-demo-closeout-package.md');

    [
      '已可客户演示',
      '仍是入口能力',
      '暂不做生产化能力',
      '不等同于完整采购管理 SaaS 已生产上线',
      '真实支付',
      '电子签章',
      'ERP/OA/财务系统深度集成',
      '商城直采、竞价采购、复杂招标和 AI',
    ].forEach((copy) => {
      expect(doc).toContain(copy);
    });
  });

  it('updates the stage twelve checklist with the three-role closeout package and next recommendation', () => {
    const checklist = read('docs/stage-twelve-execution-checklist.md');

    expect(checklist).toContain('| 10 | 三端演示总收口验收包 |');
    expect(checklist).toContain('docs/stage-twelve-three-role-demo-closeout-package.md');
    expect(checklist).toContain('scripts/stage-twelve-three-role-demo-closeout-package.test.ts');
    expect(checklist).toContain('下一轮建议：客户演示问题清单和下一阶段产品路线拆分');
  });
});
