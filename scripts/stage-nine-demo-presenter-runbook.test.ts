import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage nine demo presenter runbook', () => {
  it('documents the stage-nine presenter script with evidence and demo boundaries', () => {
    const path = 'docs/stage-nine-demo-presenter-runbook.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段九现场演示讲解稿');
    expect(doc).toContain('## 演示前检查');
    expect(doc).toContain('http://localhost:3000/');
    expect(doc).toContain('http://localhost:8080/api/v1/health');
    expect(doc).toContain('node scripts/stage-seven-onsite-demo-acceptance-check.mjs');
    expect(doc).toContain('node scripts/stage-nine-onsite-visual-acceptance-check.mjs');
    expect(doc).toContain('docs/artifacts/stage-seven-java-real-action-click-result.json');
    expect(doc).toContain('docs/artifacts/stage-seven-supplier-java-real-action-click-result.json');
    expect(doc).toContain('docs/artifacts/stage-seven-platform-java-real-action-click-result.json');
    expect(doc).toContain('docs/artifacts/stage-nine-onsite-visual-acceptance-result.json');
    expect(doc).toContain('17 个真实动作');
    expect(doc).toContain('演示准备检查面板');
    expect(doc).toContain('推荐样本');
    expect(doc).toContain('暂不声明');
  });

  it('covers buyer, supplier, and platform presenter flow with page-level talk tracks', () => {
    const doc = read('docs/stage-nine-demo-presenter-runbook.md');

    expect(doc).toContain('## 采购方主线');
    expect(doc).toContain('采购需求');
    expect(doc).toContain('提交审批');
    expect(doc).toContain('审批中心');
    expect(doc).toContain('创建询价');
    expect(doc).toContain('报价对比');
    expect(doc).toContain('生成采购订单');
    expect(doc).toContain('收货验收');
    expect(doc).toContain('登记付款');

    expect(doc).toContain('## 供应商协同主线');
    expect(doc).toContain('询价邀请');
    expect(doc).toContain('提交报价');
    expect(doc).toContain('确认订单');
    expect(doc).toContain('提交发货');
    expect(doc).toContain('提交发票');
    expect(doc).toContain('保存对账备注');

    expect(doc).toContain('## 平台运营主线');
    expect(doc).toContain('租户列表');
    expect(doc).toContain('停用租户');
    expect(doc).toContain('升级专业版');
    expect(doc).toContain('企业审核');
    expect(doc).toContain('通过企业审核');
    expect(doc).toContain('平台公告');
    expect(doc).toContain('撤回平台公告');
  });

  it('records the tenth stage-nine increment in the execution checklist', () => {
    const checklist = read('docs/stage-nine-execution-checklist.md');

    expect(checklist).toContain('| 10 | 阶段九演示人讲解稿第一轮 |');
    expect(checklist).toContain('docs/stage-nine-demo-presenter-runbook.md');
    expect(checklist).toContain('截图证据、真实动作、推荐样本和三端边界');
    expect(checklist).toContain('阶段九下一轮建议继续围绕产品研发推进：按决策表进入阶段十');
  });
});
