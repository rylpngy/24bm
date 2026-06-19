import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer detail visual hierarchy UI', () => {
  it('uses shared detail hierarchy primitives for high-frequency buyer detail panels', () => {
    const app = read('App.tsx');

    expect(app).toContain('const DetailHeroCard');
    expect(app).toContain('const DetailSection');
    expect(app).toContain('const DetailActionPanel');
    expect(app).toContain('eyebrow: string;');
    expect(app).toContain('status?: string;');
    expect(app).toContain('summaryFacts?: Array<{ label: string; value: string }>;');
    expect(app).toContain('countLabel?: string;');
    expect(app).toContain('tone?: \'blue\' | \'emerald\' | \'slate\';');

    const demandDetail = app.slice(
      app.indexOf('const DemandDetailPanelView'),
      app.indexOf('const DemandDetailOperationPanel'),
    );
    const rfqDetail = app.slice(
      app.indexOf('const RfqDetailPanelView'),
      app.indexOf('const RfqDetailOperationPanel'),
    );
    const orderDetail = app.slice(
      app.indexOf('const OrderDetailPanelView'),
      app.indexOf('const OrderDetailOperationPanel'),
    );
    const invoiceDetail = app.slice(
      app.indexOf('const InvoicePaymentDetailPanelView'),
      app.indexOf('const InvoicePaymentOperationPanel'),
    );

    expect(demandDetail).toContain('<DetailHeroCard');
    expect(demandDetail).toContain('eyebrow="采购需求"');
    expect(demandDetail).toContain('<DetailSection title="物料明细"');
    expect(demandDetail).toContain('<DetailSection title="流程检查"');

    expect(rfqDetail).toContain('<DetailHeroCard');
    expect(rfqDetail).toContain('eyebrow="询价项目"');
    expect(rfqDetail).toContain('<DetailSection title="报价排行"');
    expect(rfqDetail).toContain('<DetailSection title="关联业务"');

    expect(orderDetail).toContain('<DetailHeroCard');
    expect(orderDetail).toContain('eyebrow="采购订单"');
    expect(orderDetail).toContain('<DetailSection title="物流信息"');
    expect(orderDetail).toContain('<DetailSection title="履约轨迹"');

    expect(invoiceDetail).toContain('<DetailHeroCard');
    expect(invoiceDetail).toContain('eyebrow="发票付款"');
    expect(invoiceDetail).toContain('<DetailSection title="关联业务"');
    expect(invoiceDetail).toContain('<DetailSection title="付款轨迹"');
  });
});
