import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = readFileSync('App.tsx', 'utf8');

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe('supplier quote update deadline gate UI', () => {
  it('allows quote updates only while the related RFQ is still open for quoting', () => {
    const quoteDetailPanel = sliceBetween(
      app,
      'const SupplierQuoteDetailPanel',
      'const SupplierOrderFulfillmentDetailPanel',
    );

    expect(quoteDetailPanel).toContain('const quoteDeadlineOpen');
    expect(quoteDetailPanel).toContain('new Date(rfq.deadline).getTime() > Date.now()');
    expect(quoteDetailPanel).toContain("quote.status === '已提交'");
    expect(quoteDetailPanel).toContain("rfq?.status === '报价中'");
    expect(quoteDetailPanel).toContain('&& quoteDeadlineOpen');
    expect(quoteDetailPanel).toContain('询价已截止，报价不能再修改。');
    expect(quoteDetailPanel).toContain('报价已进入定标或归档状态，不能再修改。');
    expect(quoteDetailPanel).toContain('当前报价不在可修改状态，仅保留历史报价详情。');
  });
});
