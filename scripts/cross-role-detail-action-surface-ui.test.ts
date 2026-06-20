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

describe('cross-role detail action surface', () => {
  it('wraps platform and supplier detail buttons in a consistent action surface', () => {
    const detailSelectionSurface = sliceBetween(app, 'const DetailSelectionSurface', 'const DetailToggleButton');
    expect(detailSelectionSurface).toContain('详情操作');
    expect(detailSelectionSurface).toContain('aria-label={`${title} 详情操作`}');
    expect(detailSelectionSurface).toContain('rounded-lg border border-slate-200 bg-slate-50/80 p-3');
    expect(detailSelectionSurface).toContain('border border-white/80 bg-white/70');

    const platformAnnouncementCard = sliceBetween(app, 'const PlatformAnnouncementCard', 'const PlatformAnnouncementSummaryPanel');
    expect(platformAnnouncementCard).toContain('<DetailSelectionSurface');

    const platformReviewCard = sliceBetween(app, 'const PlatformEnterpriseReviewCard', 'const PlatformEnterpriseReviewSummaryPanel');
    expect(platformReviewCard).toContain('<DetailSelectionSurface');

    const supplierQuoteCard = sliceBetween(app, 'const SupplierQuoteHistoryCard', 'const SupplierQuoteDetailPanel');
    expect(supplierQuoteCard).toContain('<DetailSelectionSurface');

    const supplierInvoiceCard = sliceBetween(app, 'const SupplierInvoiceReceivableCard', 'const SupplierInvoiceReceivableDetailPanel');
    expect(supplierInvoiceCard).toContain('<DetailSelectionSurface');
  });
});
