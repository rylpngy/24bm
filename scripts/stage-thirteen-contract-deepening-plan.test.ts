import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage thirteen contract deepening plan', () => {
  it('records a contract-deepening plan grounded in stage twelve roadmap and stage ten evidence', () => {
    const path = 'docs/stage-thirteen-contract-deepening-plan.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十三计划：合同深化可演示切片');
    expect(doc).toContain('docs/stage-twelve-customer-demo-feedback-roadmap.md');
    expect(doc).toContain('docs/stage-ten-contract-closeout-review.md');
    expect(doc).toContain('docs/stage-ten-contract-demo-path-review.md');
    expect(doc).toContain('docs/artifacts/stage-ten-contract-demo-path-result.json');
  });

  it('defines a narrow first-round MVP instead of restarting a full contract system', () => {
    const doc = read('docs/stage-thirteen-contract-deepening-plan.md');

    [
      '第一轮 MVP',
      '合同总览',
      '合同审批',
      '履约事件',
      '订单/收货/发票/付款关系',
      '归档门禁',
      '演示操作条',
      '推荐合同样本',
      '不从零重做合同系统',
    ].forEach((copy) => {
      expect(doc).toContain(copy);
    });
  });

  it('keeps legal-signature and external integrations out of scope', () => {
    const doc = read('docs/stage-thirteen-contract-deepening-plan.md');

    [
      '暂不做',
      '电子签章',
      '法务红线批注',
      '合同版本对比',
      '外部合同系统',
      '真实支付',
      'ERP/OA/财务系统深度集成',
    ].forEach((copy) => {
      expect(doc).toContain(copy);
    });
  });

  it('defines acceptance evidence for the next executable slice', () => {
    const doc = read('docs/stage-thirteen-contract-deepening-plan.md');

    [
      '页面入口',
      '真实动作',
      'Java 数据源',
      '验收文档',
      '浏览器视觉验收',
      'npm test',
      'npm run build',
      'mvn -q test',
    ].forEach((copy) => {
      expect(doc).toContain(copy);
    });
  });

  it('starts a dedicated stage-thirteen execution checklist', () => {
    const checklist = read('docs/stage-thirteen-execution-checklist.md');

    expect(checklist).toContain('# 阶段十三执行清单');
    expect(checklist).toContain('| 1 | 合同深化可演示切片计划 |');
    expect(checklist).toContain('docs/stage-thirteen-contract-deepening-plan.md');
    expect(checklist).toContain('scripts/stage-thirteen-contract-deepening-plan.test.ts');
    expect(checklist).toContain('| 2 | 合同深化第一轮 UI 和真实动作复验 |');
    expect(checklist).toContain('docs/stage-thirteen-contract-ui-real-action-result.md');
    expect(checklist).toContain('scripts/stage-thirteen-contract-ui-real-action-readiness.test.ts');
    expect(checklist).toContain('| 3 | 合同深化浏览器视觉验收 |');
    expect(checklist).toContain('docs/stage-thirteen-contract-visual-acceptance-result.md');
    expect(checklist).toContain('scripts/stage-thirteen-contract-visual-acceptance.test.ts');
    expect(checklist).toContain('下一轮建议：合同深化现场讲解脚本');
  });
});
