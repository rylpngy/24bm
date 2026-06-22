import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage thirteen contract UI and real action readiness', () => {
  it('adds a stage-thirteen contract deepening readiness panel to the contract page', () => {
    const app = read('App.tsx');

    expect(app).toContain('type ContractDeepeningReadinessItem');
    expect(app).toContain('buildContractDeepeningReadinessItems');
    expect(app).toContain('ContractDeepeningDemoReadinessPanel');
    expect(app).toContain('data-testid="stage13-contract-demo-readiness"');
    expect(app).toContain('阶段十三合同深化');
    expect(app).toContain('合同总览');
    expect(app).toContain('合同审批');
    expect(app).toContain('履约事件');
    expect(app).toContain('订单/收货/发票/付款关系');
    expect(app).toContain('归档门禁');
    expect(app).toContain('演示操作条');
    expect(app).toContain('推荐合同样本');
  });

  it('keeps stage-thirteen contract actions on the existing Java action path', () => {
    const app = read('App.tsx');

    expect(app).toContain('真实动作复验');
    expect(app).toContain('Java 数据源');
    expect(app).toContain('本轮不新增合同工作流接口');
    expect(app).toContain("onSubmitContractApproval?.(detail.id)");
    expect(app).toContain("onUpdateContractStatus?.(detail.id, '履约完成', '已收货验收')");
    expect(app).toContain("onNavigateBuyerModule?.('receipts')");
    expect(app).toContain("onNavigateBuyerModule?.('invoices')");
    expect(app).toContain('onArchiveContract?.(detail.id)');
  });

  it('records the UI and real action recheck result in the stage-thirteen checklist', () => {
    const resultPath = 'docs/stage-thirteen-contract-ui-real-action-result.md';
    const checklist = read('docs/stage-thirteen-execution-checklist.md');

    expect(existsSync(resultPath)).toBe(true);
    expect(checklist).toContain('| 2 | 合同深化第一轮 UI 和真实动作复验 |');
    expect(checklist).toContain('stage13-contract-demo-readiness');
    expect(checklist).toContain(resultPath);
    expect(checklist).toContain('scripts/stage-thirteen-contract-ui-real-action-readiness.test.ts');
    expect(checklist).toContain('| 3 | 合同深化浏览器视觉验收 |');
    expect(checklist).toContain('下一轮建议：合同深化现场讲解脚本');
  });
});
