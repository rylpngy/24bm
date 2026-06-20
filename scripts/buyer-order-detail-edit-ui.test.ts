import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer order detail edit UI', () => {
  it('adds an editable order detail form with Java save and refresh feedback', () => {
    const app = read('App.tsx');
    const orderDetail = app.slice(
      app.indexOf('const OrderDetailPanelView'),
      app.indexOf('const OrderDetailOperationPanel'),
    );
    const buyerWorkspace = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const DemandDetailPanelView'),
    );

    expect(app).toContain('updateBuyerOrder');
    expect(app).toContain('orderUpdateBusyId');
    expect(app).toContain('updateBuyerOrderDetail');
    expect(buyerWorkspace).toContain('onUpdateOrder={onUpdateOrder}');
    expect(orderDetail).toContain('订单编辑');
    expect(orderDetail).toContain('保存订单修改');
    expect(orderDetail).toContain('刷新后回显');
    expect(orderDetail).toContain('已收货订单不可再修改预计到货日期');
    expect(orderDetail).toContain('editableOrderExpectedReceiptDate');
    expect(orderDetail).toContain('onUpdateOrder(order.id');
  });
});
