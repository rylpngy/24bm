import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven buyer demo runbook', () => {
  it('documents the full Java buyer demo path with actions, talk track, and feedback', () => {
    const runbookPath = 'docs/stage-seven-buyer-demo-runbook.md';

    expect(existsSync(runbookPath)).toBe(true);

    const runbook = read(runbookPath);
    const requiredActions = [
      '提交审批',
      '通过审批',
      '创建询价',
      '提交定标审批',
      '生成采购订单',
      '登记收货',
      '登记付款',
    ];

    expect(runbook).toContain('# 阶段七采购方现场演示脚本');
    expect(runbook).toContain('http://localhost:3000/?role=buyer&module=demands');
    expect(runbook).toContain('node scripts/stage-seven-real-action-click-check.mjs');
    expect(runbook).toContain('Java 数据源');
    expect(runbook).toContain('V120__stage_seven_real_action_demo_seed.sql');
    expect(runbook).toContain('7 个采购方主流程动作均真实点击成功');

    requiredActions.forEach((action) => {
      expect(runbook).toContain(action);
    });

    [
      '开场话术',
      '演示点击',
      '成功反馈',
      '讲解重点',
      '异常兜底',
      '验收口径',
    ].forEach((section) => {
      expect(runbook).toContain(section);
    });
  });

  it('records the eighteenth stage-seven increment as the buyer demo runbook', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(checklist).toContain('| 18 | 采购方完整现场演示脚本 |');
    expect(checklist).toContain('docs/stage-seven-buyer-demo-runbook.md');
    expect(checklist).toContain('scripts/stage-seven-demo-runbook.test.ts');
  });
});
