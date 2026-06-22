import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildContractDetailPanel, buildContractLedgerRows } from '../data/buyerAdminUi';
import { buildProcurementMvpModel, getBuyerWorkspace } from '../data/procurementModel';
import { applyJavaBuyerMasterData } from '../services/procurementApiClient';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract Java data UI mapping', () => {
  it('uses Java contract ledger data before falling back to order-derived contracts', async () => {
    const buyer = getBuyerWorkspace(buildProcurementMvpModel(), 'tenant-acme');
    const workspace = applyJavaBuyerMasterData(buyer, {
      suppliers: [{
        id: 'rel-sunrise',
        tenantId: 'tenant-acme',
        supplierId: 'ent-supplier-sunrise',
        supplierName: '晨光科技供应商',
        status: '已准入',
        level: 'A',
        categories: ['办公设备'],
        performanceScore: 94,
      }],
      materials: buyer.materials,
      departments: buyer.departments,
      users: [],
      demands: buyer.demands,
      rfqs: buyer.rfqs,
      orders: [{
        id: 'po-java-001',
        tenantId: 'tenant-acme',
        supplierId: 'ent-supplier-sunrise',
        rfqId: 'rfq-acme-1',
        amount: 118000,
        status: '待收货',
        expectedReceiptDate: '2026-07-10',
      }],
      contracts: [{
        id: 'contract-java-001',
        tenantId: 'tenant-acme',
        contractNo: 'CTR-JAVA-001',
        contractName: '晨光科技供应商采购合同',
        relatedOrderId: 'po-java-001',
        supplierId: 'ent-supplier-sunrise',
        amount: 118000,
        status: '已生效',
        archiveStatus: '未归档',
        fulfillmentProgress: '待收货',
        effectiveDate: '2026-06-20',
      }],
      deliveries: [],
      invoices: [],
      pendingApprovals: [],
      recentApprovals: [],
      notifications: [],
      approvalTemplates: [],
      auditLogs: [],
      roles: [],
    });

    const rows = buildContractLedgerRows(workspace);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'contract-java-001',
      contractNo: 'CTR-JAVA-001',
      contractName: '晨光科技供应商采购合同',
      relatedOrderId: 'po-java-001',
      supplierName: '晨光科技供应商',
      amountLabel: '¥118,000',
      status: '已生效',
      archiveStatus: '未归档',
    });
    expect(rows[0].facts).toEqual([
      { label: '合同金额', value: '¥118,000' },
      { label: '生效日期', value: '2026-06-20' },
      { label: '履约进度', value: '待收货' },
    ]);

    const detail = buildContractDetailPanel(workspace, 'contract-java-001');
    expect(detail).toMatchObject({
      contractNo: 'CTR-JAVA-001',
      relatedOrderId: 'po-java-001',
      supplierName: '晨光科技供应商',
      status: '已生效',
      archiveBoundary: '未归档合同可继续推进审批和履约；归档后只读。',
    });
    expect(detail?.facts).toContainEqual({ label: '合同来源', value: 'Java 合同台账' });
  });

  it('records stage-five round five and keeps the buyer contract page wired for Java data', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');

    expect(app).toContain('contractLedgerRows = buildContractLedgerRows(workspace)');
    expect(app).toContain('Java 合同台账');
    expect(checklist).toContain('| 5 | 合同管理 Java 实数接入 |');
    expect(checklist).toContain('第5轮已将采购方合同管理页面接入 Java 合同台账数据');
  });
});
