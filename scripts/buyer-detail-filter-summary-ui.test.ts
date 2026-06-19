import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer detail and filter summary UI', () => {
  it('adds a shared filter result summary for buyer core workflow lists', () => {
    const app = read('App.tsx');

    expect(app).toContain('const FilterResultSummary');
    expect(app).toContain('当前筛选');
    expect(app).toContain('清空筛选');
    expect(app).toContain('已选详情');
    expect(app).toContain('resultCount: number;');
    expect(app).toContain('totalCount: number;');
    expect(app).toContain('selectedLabel?: string;');

    expect(app).toContain('selectedLabel={selectedDemandDetail?.title}');
    expect(app).toContain('onClear={() => setDemandStatusFilter(\'全部状态\')}');
    expect(app).toContain('selectedLabel={selectedRfqDetail?.title}');
    expect(app).toContain('onClear={() => setRfqStatusFilter(\'全部状态\')}');
    expect(app).toContain('selectedLabel={selectedOrderDetail?.id}');
    expect(app).toContain('onClear={() => setOrderStatusFilter(\'全部状态\')}');
    expect(app).toContain('selectedLabel={selectedReceiptDetail?.id}');
    expect(app).toContain('onClear={() => setReceiptStatusFilter(\'全部状态\')}');
    expect(app).toContain('selectedLabel={selectedInvoiceDetail?.id}');
    expect(app).toContain('onClear={() => setInvoiceStatusFilter(\'全部状态\')}');
  });
});
