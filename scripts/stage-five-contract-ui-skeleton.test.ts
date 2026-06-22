import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buyerAdminModules } from '../data/adminNavigation';
import { buildProcurementMvpModel, getBuyerWorkspace } from '../data/procurementModel';
import {
  buildBuyerModuleFacts,
  buildContractDetailPanel,
  buildContractLedgerRows,
} from '../data/buyerAdminUi';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract management UI skeleton', () => {
  const workspace = getBuyerWorkspace(buildProcurementMvpModel(), 'tenant-acme');

  it('adds the buyer contract management menu between purchase orders and receipts', () => {
    expect(buyerAdminModules.map((module) => module.id)).toEqual([
      'dashboard',
      'demands',
      'approvals',
      'suppliers',
      'materials',
      'rfqs',
      'quotes',
      'orders',
      'contracts',
      'receipts',
      'invoices',
      'audit',
    ]);

    expect(buyerAdminModules.find((module) => module.id === 'contracts')).toMatchObject({
      label: '合同管理',
      desc: '合同台账、审批与履约',
    });
  });

  it('derives contract ledger rows and read-only detail panels from existing buyer data', () => {
    const rows = buildContractLedgerRows(workspace);
    expect(rows.length).toBe(workspace.orders.length);
    expect(rows[0]).toMatchObject({
      id: 'contract-po-acme-1',
      contractNo: 'CTR-PO-ACME-1',
      relatedOrderId: 'po-acme-1',
      supplierName: '奥博智能设备',
      status: '履约中',
      archiveStatus: '未归档',
    });
    expect(rows[0].facts.map((fact) => fact.label)).toEqual(['合同金额', '生效日期', '履约进度']);

    const detail = buildContractDetailPanel(workspace, rows[0].id);
    expect(detail).toMatchObject({
      id: rows[0].id,
      contractNo: rows[0].contractNo,
      supplierName: '奥博智能设备',
      relatedOrderId: 'po-acme-1',
      archiveBoundary: '未归档合同可继续推进审批和履约；归档后只读。',
    });
    expect(detail?.fulfillmentRows.map((row) => row.label)).toEqual(['采购订单', '收货验收', '发票付款', '合同归档']);
    expect(detail?.relatedRows.map((row) => row.title)).toContain('关联采购订单');
    expect(detail?.relatedRows.map((row) => row.title)).toContain('关联发票付款');

    expect(buildBuyerModuleFacts('contracts', workspace, [])).toEqual([
      { label: '合同数量', value: `${workspace.orders.length} 份` },
      { label: '履约中', value: '1 份' },
      { label: '已归档', value: '1 份' },
    ]);
  });

  it('renders the contract module in the buyer workspace and records stage-five round three', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');

    expect(app).toContain("activeModule === 'contracts'");
    expect(app).toContain('合同管理');
    expect(app).toContain('合同台账');
    expect(app).toContain('合同详情');
    expect(app).toContain('归档后只读');
    expect(app).toContain('Java 已支持状态推进、归档写入和附件元数据登记');

    expect(checklist).toContain('| 3 | 合同管理前端列表雏形 |');
    expect(checklist).toContain('第3轮已新增采购方合同管理菜单、合同台账和只读详情面板');
    expect(checklist).toContain('scripts/stage-five-contract-ui-skeleton.test.ts');
  });
});
