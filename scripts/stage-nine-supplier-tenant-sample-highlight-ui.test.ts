import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage nine supplier and tenant sample highlight UI', () => {
  it('highlights supplier opportunity, order, and receivable demo cards', () => {
    const app = read('App.tsx');

    expect(app).toContain("const supplierOpportunityDemoHighlight = rfq.id === 'rfq-stage7-supplier-quote-ready'");
    expect(app).toContain("testId: `stage9-demo-sample-supplier-opportunity-${rfq.id}`");
    expect(app).toContain("const supplierOrderDemoHighlight = order.id === 'po-stage7-supplier-confirm-ready'");
    expect(app).toContain("|| order.id === 'po-stage7-supplier-delivery-ready'");
    expect(app).toContain("|| order.id === 'po-stage7-supplier-invoice-ready'");
    expect(app).toContain("testId: `stage9-demo-sample-supplier-order-${order.id}`");
    expect(app).toContain("demoHighlight={invoice.id === 'inv-stage7-supplier-receivable-ready'");
    expect(app).toContain("testId: `stage9-demo-sample-supplier-receivable-${invoice.id}`");
  });

  it('highlights the platform tenant action demo card in desktop and mobile tenant lists', () => {
    const app = read('App.tsx');

    expect(app).toContain("const platformTenantDemoHighlight = tenant.id === 'tenant-stage7-platform-action'");
    expect(app).toContain("testId: `stage9-demo-sample-platform-tenant-${tenant.id}`");
    expect(app).toContain("ariaLabel={`${tenant.name} 租户摘要`}");
    expect(app).toContain("demoHighlight={platformTenantDemoHighlight");
  });

  it('records the fifth stage-nine increment in the checklist', () => {
    const checklist = read('docs/stage-nine-execution-checklist.md');

    expect(checklist).toContain('| 5 | 推荐演示样本卡片高亮第二轮 |');
    expect(checklist).toContain('供应商商机、销售订单、发票应收和平台租户操作卡片');
    expect(checklist).toContain('scripts/stage-nine-supplier-tenant-sample-highlight-ui.test.ts');
  });
});
