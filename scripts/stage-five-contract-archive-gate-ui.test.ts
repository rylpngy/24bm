import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildProcurementMvpModel, getBuyerWorkspace } from '../data/procurementModel';
import { buildContractDetailPanel, buildContractLedgerRows } from '../data/buyerAdminUi';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive gate UI', () => {
  it('identifies contracts that can be archived only after receipt and payment are complete', () => {
    const workspace = getBuyerWorkspace(buildProcurementMvpModel(), 'tenant-acme');

    const blockedContract = buildContractLedgerRows(workspace).find((row) => row.relatedOrderId === 'po-acme-1');
    const readyContract = buildContractLedgerRows(workspace).find((row) => row.relatedOrderId === 'po-acme-2');

    expect(buildContractDetailPanel(workspace, blockedContract!.id)?.archiveReadiness.status).toBe('暂不可归档');
    expect(buildContractDetailPanel(workspace, blockedContract!.id)?.canArchive).toBe(false);

    expect(buildContractDetailPanel(workspace, readyContract!.id)?.archiveReadiness.status).toBe('已归档');
    expect(buildContractDetailPanel(workspace, readyContract!.id)?.canArchive).toBe(false);
  });

  it('disables the archive action when linkage checks are not ready and records round nine', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');

    expect(app).toContain('contractArchiveDisabled');
    expect(app).toContain("detail.archiveReadiness.status !== '可归档'");
    expect(app).toContain('归档条件未满足');
    expect(app).toContain('请先处理阻断原因');

    expect(checklist).toContain('| 9 | 合同归档联动门禁 |');
    expect(checklist).toContain('第9轮已将归档合同按钮绑定到收货和发票付款联动检查');
  });
});
