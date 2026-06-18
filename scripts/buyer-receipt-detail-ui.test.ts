import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer receipt detail UI', () => {
  it('connects receipt inspection selections to a receipt detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');

    expect(buyerAdminUi).toContain('buildReceiptInspectionDetailPanel');
    expect(buyerAdminUi).toContain('logisticsFacts');
    expect(buyerAdminUi).toContain('acceptanceChecks');
    expect(buyerAdminUi).toContain('relatedRows');

    expect(app).toContain('buildReceiptInspectionDetailPanel');
    expect(app).toContain('selectedReceiptOrderId');
    expect(app).toContain('setSelectedReceiptOrderId');
    expect(app).toContain('ReceiptInspectionDetailPanelView');
    expect(app).toContain('验收详情');
    expect(app).toContain('物流信息');
    expect(app).toContain('验收检查');
    expect(app).toContain('关联业务');
  });
});
