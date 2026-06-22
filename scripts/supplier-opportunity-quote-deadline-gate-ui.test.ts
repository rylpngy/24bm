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

describe('supplier opportunity quote deadline gate UI', () => {
  it('blocks new quote submission on expired RFQ invitations', () => {
    const supplierWorkspace = sliceBetween(app, 'const SupplierWorkspaceView', 'const HeroBand');
    const opportunityList = sliceBetween(app, "Panel title=\"商机与报价\"", "Panel title=\"报价记录\"");

    expect(supplierWorkspace).toContain('isSupplierRfqQuoteOpen');
    expect(supplierWorkspace).toContain('new Date(rfq.deadline).getTime() > Date.now()');
    expect(opportunityList).toContain('const quoteOpen = isSupplierRfqQuoteOpen(rfq)');
    expect(opportunityList).toContain("javaEnabled && quoteOpen && !hasMyQuote");
    expect(opportunityList).toContain('询价已截止，不能再提交报价。');
    expect(opportunityList).toContain('disabled={declinedOpportunityIds.includes(rfq.id) || quoteBusy || !quoteOpen');
  });
});
