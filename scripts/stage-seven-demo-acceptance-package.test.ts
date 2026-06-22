import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven onsite demo acceptance package', () => {
  it('keeps a combined buyer supplier and platform real-click acceptance artifact', () => {
    const artifactPath = 'docs/artifacts/stage-seven-onsite-demo-acceptance-result.json';

    expect(existsSync(artifactPath)).toBe(true);

    const artifact = JSON.parse(read(artifactPath)) as {
      dataSource: string;
      totalActions: number;
      failedTotal: number;
      buyer: { actionCount: number; failedCount: number; artifactPath: string };
      supplier: { actionCount: number; failedCount: number; artifactPath: string };
      platform: { actionCount: number; failedCount: number; artifactPath: string };
      runbookPath: string;
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
    expect(artifact.runbookPath).toBe('docs/stage-seven-onsite-demo-acceptance-package.md');
  });

  it('documents a one-command onsite demo acceptance workflow', () => {
    const packageDocPath = 'docs/stage-seven-onsite-demo-acceptance-package.md';

    expect(existsSync(packageDocPath)).toBe(true);

    const packageDoc = read(packageDocPath);

    expect(packageDoc).toContain('# 阶段七现场演示验收包');
    expect(packageDoc).toContain('node scripts/stage-seven-onsite-demo-acceptance-check.mjs');
    expect(packageDoc).toContain('采购方 7 个真实点击动作');
    expect(packageDoc).toContain('供应商 5 个真实点击动作');
    expect(packageDoc).toContain('平台端 5 个真实点击动作');
    expect(packageDoc).toContain('docs/stage-seven-buyer-demo-runbook.md');
    expect(packageDoc).toContain('docs/stage-seven-supplier-demo-runbook.md');
    expect(packageDoc).toContain('docs/stage-seven-platform-demo-runbook.md');
    expect(packageDoc).toContain('V120__stage_seven_real_action_demo_seed.sql');
    expect(packageDoc).toContain('失败兜底');
    expect(packageDoc).toContain('不声明真实支付、电子签章、ERP 深度集成已经完成');
  });

  it('records the twenty-first stage-seven increment as the onsite demo acceptance package', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');
    const script = read('scripts/stage-seven-onsite-demo-acceptance-check.mjs');

    expect(checklist).toContain('| 21 | 采购方与供应商现场演示验收包 |');
    expect(checklist).toContain('stage-seven-onsite-demo-acceptance-result.json');
    expect(checklist).toContain('采购方 7 个动作与供应商 5 个动作合计 12 个真实点击动作');
    expect(checklist).toContain('| 27 | 三端现场演示总验收包 |');
    expect(script).toContain('stage-seven-real-action-click-check.mjs');
    expect(script).toContain('stage-seven-supplier-real-action-click-check.mjs');
    expect(script).toContain('stage-seven-platform-real-action-click-check.mjs');
    expect(script).toContain('stage-seven-onsite-demo-acceptance-result.json');
  });
});
