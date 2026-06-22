import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven platform demo runbook', () => {
  it('documents the platform operation demo story and acceptance commands', () => {
    const runbook = read('docs/stage-seven-platform-demo-runbook.md');

    expect(runbook).toContain('# 阶段七平台运营端现场演示脚本');
    expect(runbook).toContain('平台看板 → 租户列表 → 企业审核 → 平台公告');
    expect(runbook).toContain('平台方提供 SaaS 运营底座，不直接参与采购业务决策');
    expect(runbook).toContain('租户状态、套餐、用户容量和询价功能开关');
    expect(runbook).toContain('企业入驻资料、资料确认、风险确认和审核结论');
    expect(runbook).toContain('公告发布、编辑、撤回和站内通知触达');
    expect(runbook).toContain('npm test -- scripts/stage-seven-platform-demo-path-ui.test.ts');
    expect(runbook).toContain('npm run java:smoke');
  });

  it('records the twenty-fourth stage-seven increment as platform demo runbook', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(checklist).toContain('| 24 | 平台运营端现场演示脚本 |');
    expect(checklist).toContain('docs/stage-seven-platform-demo-runbook.md');
    expect(checklist).toContain('scripts/stage-seven-platform-demo-runbook.test.ts');
  });
});
