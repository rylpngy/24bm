import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage thirteen contract presenter runbook', () => {
  it('documents a five-minute contract-deepening presenter script with current visual evidence', () => {
    const path = 'docs/stage-thirteen-contract-presenter-runbook.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十三合同深化现场讲解脚本');
    expect(doc).toContain('## 演示前检查');
    expect(doc).toContain('http://localhost:3000/?role=buyer&module=contracts');
    expect(doc).toContain('http://localhost:8080/api/v1/health');
    expect(doc).toContain('node scripts/stage-thirteen-contract-visual-acceptance-check.mjs');
    expect(doc).toContain('docs/artifacts/stage-thirteen-contract-visual-acceptance-result.json');
    expect(doc).toContain('stage13-contract-demo-readiness');
    expect(doc).toContain('stage10-contract-demo-action-loop');
    expect(doc).toContain('5 分钟');
    expect(doc).toContain('无 `argument type mismatch`');
    expect(doc).toContain('无 React runtime error');
    expect(doc).toContain('无整页横向溢出');
  });

  it('covers the customer-facing talk track for overview, real actions, evidence, and archive gate', () => {
    const doc = read('docs/stage-thirteen-contract-presenter-runbook.md');

    [
      '合同总览',
      '提交合同审批',
      '推进履约',
      '处理收货验收',
      '处理发票付款',
      '归档合同',
      '推荐合同样本',
      '客户提问兜底',
      '合同不替代订单、收货、发票和付款模块',
      '本轮不新增合同工作流接口',
    ].forEach((copy) => {
      expect(doc).toContain(copy);
    });
  });

  it('keeps scope boundaries explicit and records the fourth stage-thirteen increment', () => {
    const doc = read('docs/stage-thirteen-contract-presenter-runbook.md');
    const checklist = read('docs/stage-thirteen-execution-checklist.md');

    expect(doc).toContain('## 暂不声明');
    expect(doc).toContain('不声明电子签章');
    expect(doc).toContain('不声明真实支付');
    expect(doc).toContain('不声明完整法务合同生命周期');
    expect(doc).toContain('不声明外部合同系统集成');
    expect(doc).toContain('不声明 ERP/OA/财务系统深度集成');

    expect(checklist).toContain('| 4 | 合同深化现场讲解脚本 |');
    expect(checklist).toContain('docs/stage-thirteen-contract-presenter-runbook.md');
    expect(checklist).toContain('scripts/stage-thirteen-contract-presenter-runbook.test.ts');
    expect(checklist).toContain('下一轮建议：阶段十三合同深化收口复盘');
  });
});
