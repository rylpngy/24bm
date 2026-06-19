import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('cross-role detail visual hierarchy UI', () => {
  it('reuses detail hierarchy primitives for platform and supplier detail cards', () => {
    const app = read('App.tsx');

    const platformReviewCard = app.slice(
      app.indexOf('const PlatformEnterpriseReviewCard'),
      app.indexOf('const PlatformEnterpriseReviewSummaryPanel'),
    );
    const platformAnnouncementCard = app.slice(
      app.indexOf('const PlatformAnnouncementCard'),
      app.indexOf('const PlatformAnnouncementSummaryPanel'),
    );
    const supplierQuoteCard = app.slice(
      app.indexOf('const SupplierQuoteHistoryCard'),
      app.indexOf('const SupplierInvoiceReceivableSummaryPanel'),
    );
    const supplierInvoiceCard = app.slice(
      app.indexOf('const SupplierInvoiceReceivableCard'),
      app.indexOf('const SupplierOrderActionSummaryPanel'),
    );

    expect(platformReviewCard).toContain('<DetailHeroCard');
    expect(platformReviewCard).toContain('eyebrow="企业审核"');
    expect(platformReviewCard).toContain('summaryFacts={[');
    expect(platformReviewCard).toContain("{ label: '企业类型', value: formatEnterpriseType(review.type) }");
    expect(platformReviewCard).toContain("{ label: '下一步', value: nextAction }");

    expect(platformAnnouncementCard).toContain('<DetailHeroCard');
    expect(platformAnnouncementCard).toContain('eyebrow="平台公告"');
    expect(platformAnnouncementCard).toContain('<DetailSection title="公告正文"');

    expect(supplierQuoteCard).toContain('<DetailHeroCard');
    expect(supplierQuoteCard).toContain('eyebrow="报价记录"');
    expect(supplierQuoteCard).toContain("{ label: '报价金额', value: currency(quote.amount) }");

    expect(supplierInvoiceCard).toContain('<DetailHeroCard');
    expect(supplierInvoiceCard).toContain('eyebrow="发票应收"');
    expect(supplierInvoiceCard).toContain("{ label: '回款进度', value: paymentProgress }");
  });
});
