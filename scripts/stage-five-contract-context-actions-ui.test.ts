import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildProcurementMvpModel, getBuyerWorkspace } from '../data/procurementModel';
import { buildContractDetailPanel, buildContractLedgerRows } from '../data/buyerAdminUi';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract context actions UI', () => {
  it('derives context action entries for receipt, invoice and archive follow-up', () => {
    const workspace = getBuyerWorkspace(buildProcurementMvpModel(), 'tenant-acme');
    const blockedContract = buildContractLedgerRows(workspace).find((row) => row.relatedOrderId === 'po-acme-1');
    const completedContract = buildContractLedgerRows(workspace).find((row) => row.relatedOrderId === 'po-acme-2');

    expect(buildContractDetailPanel(workspace, blockedContract!.id)?.contextActionRows).toEqual([
      {
        label: '处理收货验收',
        moduleId: 'receipts',
        moduleLabel: '收货验收',
        status: '待处理',
        hint: '订单仍未完成收货验收，进入收货验收池登记验收结果。',
      },
      {
        label: '处理发票付款',
        moduleId: 'invoices',
        moduleLabel: '发票付款',
        status: '待处理',
        hint: '发票仍未付款，进入发票付款页处理付款状态。',
      },
      {
        label: '处理合同归档',
        moduleId: 'contracts',
        moduleLabel: '合同管理',
        status: '暂不可用',
        hint: '归档前需要先完成：收货验收未完成，发票付款未完成。',
      },
    ]);
    expect(buildContractDetailPanel(workspace, completedContract!.id)?.contextActionRows[2]).toEqual({
      label: '查看归档审计',
      moduleId: 'contracts',
      moduleLabel: '合同管理',
      status: '已完成',
      hint: '合同已归档，仅保留审计追溯和关联业务查询。',
    });
  });

  it('renders contract context action entry buttons and records round eighteen', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('合同上下文操作入口');
    expect(app).toContain('contextActionRows');
    expect(app).toContain('onNavigateBuyerModule');
    expect(app).toContain('去收货验收');
    expect(app).toContain('去发票付款');
    expect(app).toContain("setActiveRoleModule('buyer', moduleId)");

    expect(checklist).toContain('| 18 | 合同上下文操作入口 |');
    expect(checklist).toContain('第18轮已在合同详情页补充收货验收、发票付款和合同归档的上下文操作入口');
    expect(walkthrough).toContain('合同上下文操作入口');
  });
});
