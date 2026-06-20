import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe('platform and supplier readonly detail affordance UI', () => {
  it('adds filter summaries and detail affordances to platform readonly lists', () => {
    const app = read('App.tsx');
    const platformWorkspace = sliceBetween(app, 'const PlatformWorkspace', 'const PlatformAnnouncementPublishPanel');
    const reviewCard = sliceBetween(app, 'const PlatformEnterpriseReviewCard', 'const PlatformEnterpriseReviewSummaryPanel');
    const announcementCard = sliceBetween(app, 'const PlatformAnnouncementCard', 'const PlatformAnnouncementSummaryPanel');

    expect(platformWorkspace).toContain('const [selectedPlatformTenantId');
    expect(platformWorkspace).toContain('const [selectedPlatformReviewId');
    expect(platformWorkspace).toContain('const [selectedPlatformAnnouncementId');
    expect(platformWorkspace).toContain('label="租户列表筛选结果"');
    expect(platformWorkspace).toContain('label="企业审核筛选结果"');
    expect(platformWorkspace).toContain('label="平台公告筛选结果"');
    expect(platformWorkspace).toContain('selectedLabel={selectedPlatformTenantId}');
    expect(platformWorkspace).toContain('selected={selectedPlatformTenantId === tenant.id}');
    expect(reviewCard).toContain('<DetailSelectionSurface');
    expect(reviewCard).toContain('selected={selected}');
    expect(announcementCard).toContain('<DetailSelectionSurface');
    expect(announcementCard).toContain('selected={selected}');
  });

  it('adds selected detail affordances to supplier quote order and receivable readonly lists', () => {
    const app = read('App.tsx');
    const supplierWorkspace = sliceBetween(app, 'const SupplierWorkspaceView', 'const SupplierProfileCapabilityCard');
    const quoteCard = sliceBetween(app, 'const SupplierQuoteHistoryCard', 'const SupplierInvoiceReceivableSummaryPanel');
    const invoiceCard = sliceBetween(app, 'const SupplierInvoiceReceivableCard', 'const SupplierOrderActionSummaryPanel');

    expect(supplierWorkspace).toContain('const [selectedSupplierQuoteId');
    expect(supplierWorkspace).toContain('const [selectedSupplierOrderId');
    expect(supplierWorkspace).toContain('const [selectedSupplierInvoiceId');
    expect(supplierWorkspace).toContain('selectedLabel={selectedSupplierQuoteId}');
    expect(supplierWorkspace).toContain('selected={selectedSupplierOrderId === order.id}');
    expect(supplierWorkspace).toContain('onClick={() => setSelectedSupplierOrderId(order.id)}');
    expect(quoteCard).toContain('<DetailSelectionSurface');
    expect(quoteCard).toContain('selected={selected}');
    expect(invoiceCard).toContain('<DetailSelectionSurface');
    expect(invoiceCard).toContain('selected={selected}');
  });
});
