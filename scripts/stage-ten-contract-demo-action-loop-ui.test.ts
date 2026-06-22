import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage ten contract demo action loop UI', () => {
  it('adds a contract demo action loop panel to the contract detail view', () => {
    const app = read('App.tsx');

    expect(app).toContain('const contractDemoActionLoopRows = [');
    expect(app).toContain('合同演示动作闭环');
    expect(app).toContain('data-testid="stage10-contract-demo-action-loop"');
    expect(app).toContain('提交合同审批');
    expect(app).toContain('推进履约');
    expect(app).toContain('处理收货验收');
    expect(app).toContain('处理发票付款');
    expect(app).toContain('归档合同');
    expect(app).toContain('动作反馈');
    expect(app).toContain('下一步承接');
    expect(app).toContain('真实动作按钮');
  });

  it('keeps the action loop bound to existing contract actions and navigation instead of new APIs', () => {
    const app = read('App.tsx');

    expect(app).toContain("onSubmitContractApproval?.(detail.id)");
    expect(app).toContain("onUpdateContractStatus?.(detail.id, '履约完成', '已收货验收')");
    expect(app).toContain("onNavigateBuyerModule?.('receipts')");
    expect(app).toContain("onNavigateBuyerModule?.('invoices')");
    expect(app).toContain('onArchiveContract?.(detail.id)');
    expect(app).toContain('本轮不新增合同工作流接口');
  });

  it('records the fourth stage-ten increment and updates the next recommendation', () => {
    const checklist = read('docs/stage-ten-execution-checklist.md');

    expect(checklist).toContain('| 4 | 合同演示动作闭环 |');
    expect(checklist).toContain('stage10-contract-demo-action-loop');
    expect(checklist).toContain('提交合同审批、推进履约、处理收货验收、处理发票付款和归档合同');
    expect(checklist).toContain('| 5 | 合同现场讲解脚本和 Java 视觉复跑 |');
    expect(checklist).toContain('| 6 | 阶段十合同演示收口复盘 |');
    expect(checklist).toContain('下一轮建议：回到采购主流程 polish');
  });
});
