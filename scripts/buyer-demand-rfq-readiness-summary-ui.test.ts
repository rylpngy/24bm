import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = () => readFileSync('App.tsx', 'utf8');
const checklist = () => readFileSync('docs/stage-three-round-two-execution-checklist.md', 'utf8');

describe('buyer demand to RFQ readiness summary UI', () => {
  it('surfaces a list-level RFQ readiness summary for purchase demands', () => {
    const source = app();
    const buyerWorkspace = source.slice(
      source.indexOf('const BuyerWorkspaceView'),
      source.indexOf('const DemandDetailPanelView'),
    );
    const demandModule = source.slice(
      source.indexOf('<Panel title="采购需求列表"'),
      source.indexOf('<DemandDetailPanelView'),
    );

    expect(buyerWorkspace).toContain('demandToRfqReadyCount');
    expect(buyerWorkspace).toContain('demandToRfqLinkedCount');
    expect(buyerWorkspace).toContain('demandToRfqApprovalBlockedCount');
    expect(buyerWorkspace).toContain('demandToRfqSupplierBlockedCount');
    expect(demandModule).toContain('转询价准备摘要');
    expect(demandModule).toContain('可转询价');
    expect(demandModule).toContain('已关联询价');
    expect(demandModule).toContain('审批阻断');
    expect(demandModule).toContain('供应商准入阻断');
    expect(demandModule).toContain('优先处理审批阻断和供应商准入阻断');
  });

  it('uses the canonical approved status when explaining RFQ creation availability', () => {
    const source = app();
    const demandDetail = source.slice(
      source.indexOf('const DemandDetailPanelView'),
      source.indexOf('const DemandDetailOperationPanel'),
    );

    expect(demandDetail).toContain("demand.status !== '已通过'");
    expect(demandDetail).not.toContain("demand.status !== '已批准'");
  });

  it('records the sixty first stage-three buyer flow increment in the checklist', () => {
    const docs = checklist();

    expect(docs).toContain('| 61 | 采购需求转询价准备摘要 |');
    expect(docs).toContain('scripts/buyer-demand-rfq-readiness-summary-ui.test.ts');
    expect(docs).toContain('转询价准备摘要');
  });
});
