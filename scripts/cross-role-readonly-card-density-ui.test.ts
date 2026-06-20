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

describe('cross-role readonly card density', () => {
  it('uses a shared surface for platform and supplier readonly detail cards', () => {
    const readonlySurface = sliceBetween(app, 'const ReadonlyDetailCardSurface', 'const DetailSelectionSurface');
    expect(readonlySurface).toContain('aria-label={`${title} 只读详情卡片`}');
    expect(readonlySurface).toContain('rounded-lg border border-l-4 bg-white p-4 shadow-sm shadow-slate-200/50');
    expect(readonlySurface).toContain("selected ? 'border-blue-200 border-l-blue-400 ring-2 ring-blue-100'");
    expect(readonlySurface).toContain('hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm');
    expect(readonlySurface).toContain('focus-within:ring-2 focus-within:ring-blue-100');

    const platformAnnouncementCard = sliceBetween(app, 'const PlatformAnnouncementCard', 'const PlatformAnnouncementSummaryPanel');
    expect(platformAnnouncementCard).toContain('<ReadonlyDetailCardSurface');

    const platformReviewCard = sliceBetween(app, 'const PlatformEnterpriseReviewCard', 'const PlatformEnterpriseReviewSummaryPanel');
    expect(platformReviewCard).toContain('<ReadonlyDetailCardSurface');

    const supplierQuoteCard = sliceBetween(app, 'const SupplierQuoteHistoryCard', 'const SupplierQuoteDetailPanel');
    expect(supplierQuoteCard).toContain('<ReadonlyDetailCardSurface');

    const supplierInvoiceCard = sliceBetween(app, 'const SupplierInvoiceReceivableCard', 'const SupplierInvoiceReceivableDetailPanel');
    expect(supplierInvoiceCard).toContain('<ReadonlyDetailCardSurface');
  });
});
