import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment block resolution three-way rebuild action UI', () => {
  it('wires a real Java three-way rebuild action into buyer invoice payment flow', () => {
    const app = read('App.tsx');
    const buyerWorkspaceType = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const BuyerDashboard'),
    );
    const buyerInvoicesModule = app.slice(
      app.indexOf("activeModule === 'invoices'"),
      app.indexOf("activeModule === 'audit'"),
    );
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(app).toContain('rebuildBuyerThreeWayMatchSnapshots');
    expect(app).toContain('javaApiClient.rebuildBuyerThreeWayMatches()');
    expect(app).toContain('setBuyerFulfillmentBusyId(\'three-way-rebuild\')');
    expect(app).toContain('setWorkflowStatus(`三单匹配快照已刷新：${result.rebuiltCount} 条`)');
    expect(buyerWorkspaceType).toContain('onRebuildThreeWayMatches: () => void');
    expect(buyerInvoicesModule).toContain('onRebuildThreeWayMatches={onRebuildThreeWayMatches}');
    expect(ledgerPanel).toContain('onRebuildThreeWayMatches?: () => void');
    expect(ledgerPanel).toContain('onRebuildThreeWayMatches()');
    expect(ledgerPanel).toContain('刷新三单匹配');
    expect(ledgerPanel).toContain("buyerFulfillmentBusyId === 'three-way-rebuild'");
  });

  it('records the sixty first stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 61 | 三单匹配刷新真实动作 |');
    expect(checklist).toContain('scripts/payment-block-resolution-three-way-rebuild-ui.test.ts');
    expect(checklist).toContain('调用 Java `rebuildBuyerThreeWayMatches()`');
  });
});
