import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer RFQ detail edit UI', () => {
  it('adds an editable RFQ detail form with Java save and refresh feedback', () => {
    const app = read('App.tsx');
    const rfqDetail = app.slice(
      app.indexOf('const RfqDetailPanelView'),
      app.indexOf('const RfqDetailOperationPanel'),
    );
    const buyerWorkspace = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const DemandDetailPanelView'),
    );

    expect(app).toContain('updateBuyerRfq');
    expect(app).toContain('rfqUpdateBusyId');
    expect(app).toContain('updateBuyerRfqDetail');
    expect(buyerWorkspace).toContain('onUpdateRfq={onUpdateRfq}');
    expect(rfqDetail).toContain('询价编辑');
    expect(rfqDetail).toContain('保存询价修改');
    expect(rfqDetail).toContain('刷新后回显');
    expect(rfqDetail).toContain('只能编辑报价中的 RFQ');
    expect(rfqDetail).toContain('editableRfqTitle');
    expect(rfqDetail).toContain('editableRfqDeadline');
    expect(rfqDetail).toContain('editableRfqSupplierIds');
    expect(rfqDetail).toContain('onUpdateRfq(rfq.id');
  });
});
