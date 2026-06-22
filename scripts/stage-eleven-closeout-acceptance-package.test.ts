import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage eleven closeout acceptance package', () => {
  it('documents the stage-eleven closeout package with current evidence and boundaries', () => {
    const path = 'docs/stage-eleven-closeout-acceptance-package.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十一采购方主流程演示收口验收包');
    expect(doc).toContain('## 收口结论');
    expect(doc).toContain('采购方 7 个主流程页面');
    expect(doc).toContain('产品可演示阶段目标');
    expect(doc).toContain('## 验收证据');
    expect(doc).toContain('docs/stage-eleven-buyer-main-flow-visual-density-result.md');
    expect(doc).toContain('docs/artifacts/stage-eleven-buyer-main-flow-visual-density-result.json');
    expect(doc).toContain('docs/stage-eleven-customer-demo-runbook.md');
    expect(doc).toContain('node scripts/stage-eleven-buyer-main-flow-visual-density-check.mjs');
    expect(doc).toContain('14 个页面/视口组合');
    expect(doc).toContain('17 个真实动作');
  });

  it('records the buyer main-flow demo acceptance matrix and onsite fallback steps', () => {
    const doc = read('docs/stage-eleven-closeout-acceptance-package.md');

    [
      '采购需求',
      '审批中心',
      '询价项目',
      '报价对比',
      '采购订单',
      '收货验收',
      '发票付款',
      '操作条',
      '首屏业务焦点',
      '动作区可见性',
      '演示数据瘦身',
      'http://localhost:3000/?role=buyer&module=demands',
      'http://localhost:8080/api/v1/health',
      '失败兜底',
      '暂不声明',
      '真实支付',
      '电子签章',
      'ERP/OA/财务系统深度集成',
    ].forEach((copy) => {
      expect(doc).toContain(copy);
    });
  });

  it('keeps a customer-facing demo runbook for the stage-eleven buyer flow', () => {
    const path = 'docs/stage-eleven-customer-demo-runbook.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十一客户演示讲解稿');
    expect(doc).toContain('## 开场定位');
    expect(doc).toContain('## 演示前检查');
    expect(doc).toContain('## 采购方 7 页讲解顺序');
    expect(doc).toContain('提交审批');
    expect(doc).toContain('通过审批');
    expect(doc).toContain('邀请供应商');
    expect(doc).toContain('提交定标审批');
    expect(doc).toContain('生成采购订单');
    expect(doc).toContain('登记收货');
    expect(doc).toContain('登记付款');
    expect(doc).toContain('供应商协同和平台运营如何衔接');
    expect(doc).toContain('结束话术');
  });

  it('records the eighth stage-eleven increment as closeout acceptance', () => {
    const checklist = read('docs/stage-eleven-execution-checklist.md');

    expect(checklist).toContain('| 8 | 阶段十一演示收口验收包 |');
    expect(checklist).toContain('docs/stage-eleven-closeout-acceptance-package.md');
    expect(checklist).toContain('docs/stage-eleven-customer-demo-runbook.md');
    expect(checklist).toContain('下一轮建议：进入阶段十二');
  });
});
