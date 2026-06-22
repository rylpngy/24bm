import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildProcurementMvpModel, getBuyerWorkspace } from '../data/procurementModel';
import { buildContractDetailPanel, buildContractLedgerRows } from '../data/buyerAdminUi';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract linkage UI', () => {
  it('summarizes order receipt invoice linkage and archive blocking reasons', () => {
    const workspace = getBuyerWorkspace(buildProcurementMvpModel(), 'tenant-acme');
    const contract = buildContractLedgerRows(workspace).find((row) => row.relatedOrderId === 'po-acme-1');
    expect(contract).toBeDefined();

    const detail = buildContractDetailPanel(workspace, contract!.id);

    expect(detail?.archiveReadiness).toEqual({
      status: '暂不可归档',
      reason: '收货验收未完成，发票付款未完成',
      nextAction: '先完成收货验收，再处理发票付款',
    });
    expect(detail?.linkageCheckRows).toEqual([
      { label: '采购订单', value: 'po-acme-1 · 待收货', status: '已关联' },
      { label: '收货验收', value: '运输中', status: '阻断归档' },
      { label: '发票付款', value: '待付款', status: '阻断归档' },
      { label: '合同归档', value: '未归档', status: '等待前置完成' },
    ]);
  });

  it('renders contract linkage signals in the buyer contract detail panel and checklist', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');

    expect(app).toContain('订单-合同-收货-发票付款联动');
    expect(app).toContain('归档阻断原因');
    expect(app).toContain('archiveReadiness');
    expect(app).toContain('linkageCheckRows');

    expect(checklist).toContain('| 8 | 合同与订单付款联动台账 |');
    expect(checklist).toContain('第8轮已补充订单、收货、发票付款对合同归档的联动检查');
  });
});
