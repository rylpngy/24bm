import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildProcurementMvpModel, getBuyerWorkspace } from '../data/procurementModel';
import { buildContractDetailPanel, buildContractLedgerRows } from '../data/buyerAdminUi';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract fulfillment linkage UI', () => {
  it('derives fulfillment linkage summary, risk, owner and progress from order receipt and invoice state', () => {
    const workspace = getBuyerWorkspace(buildProcurementMvpModel(), 'tenant-acme');
    const blockedContract = buildContractLedgerRows(workspace).find((row) => row.relatedOrderId === 'po-acme-1');
    const completedContract = buildContractLedgerRows(workspace).find((row) => row.relatedOrderId === 'po-acme-2');

    expect(buildContractDetailPanel(workspace, blockedContract!.id)?.fulfillmentLinkageSummary).toEqual({
      stage: '收货与付款阻断',
      owner: '采购执行 / 财务协同',
      riskLevel: '高',
      progressPercent: 50,
      nextStep: '先完成收货验收，再处理发票付款',
    });
    expect(buildContractDetailPanel(workspace, completedContract!.id)?.fulfillmentLinkageSummary).toEqual({
      stage: '履约完成',
      owner: '合同管理员',
      riskLevel: '低',
      progressPercent: 100,
      nextStep: '查看归档审计和关联业务',
    });
  });

  it('renders the fulfillment linkage summary and records round seventeen', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('合同履约联动摘要');
    expect(app).toContain('fulfillmentLinkageSummary');
    expect(app).toContain('履约进度百分比');
    expect(app).toContain('下一步责任人');

    expect(checklist).toContain('| 17 | 合同履约联动摘要细化 |');
    expect(checklist).toContain('第17轮已在合同详情页补充履约阶段、责任人、风险等级、进度百分比和下一步动作');
    expect(walkthrough).toContain('合同履约联动摘要细化');
  });
});
