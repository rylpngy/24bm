import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage nine demo sample card highlight UI', () => {
  it('adds a reusable demo highlight contract to shared cards', () => {
    const app = read('App.tsx');

    expect(app).toContain('type DemoSampleHighlight = {');
    expect(app).toContain('demoHighlight?: DemoSampleHighlight');
    expect(app).toContain('推荐演示样本');
    expect(app).toContain('data-testid={demoHighlight?.testId}');
    expect(app).toContain('border-sky-300 bg-sky-50');
  });

  it('highlights buyer workflow and approval cards for stage-seven samples', () => {
    const app = read('App.tsx');

    expect(app).toContain("demoHighlight={demand.id === 'dem-stage7-submit-ready' || demand.id === 'dem-stage7-rfq-ready'");
    expect(app).toContain("testId: `stage9-demo-sample-demand-${demand.id}`");
    expect(app).toContain("demoHighlight={approvalRow.id === 'approval-stage7-demand-pending'");
    expect(app).toContain("testId: `stage9-demo-sample-approval-${approvalRow.id}`");
    expect(app).toContain("demoHighlight={rfq.id === 'rfq-stage7-award-ready' || rfq.id === 'rfq-stage7-order-ready'");
    expect(app).toContain("testId: `stage9-demo-sample-rfq-${rfq.id}`");
    expect(app).toContain("demoHighlight={orderRow.id === 'po-stage7-receipt-ready'");
    expect(app).toContain("demoHighlight={invoiceRow.id === 'inv-stage7-payment-ready'");
  });

  it('highlights platform review and announcement demo cards', () => {
    const app = read('App.tsx');

    expect(app).toContain("demoHighlight={review.id === 'ent-stage7-platform-review-ready'");
    expect(app).toContain("testId: `stage9-demo-sample-platform-review-${review.id}`");
    expect(app).toContain("demoHighlight={announcement.id === 'announcement-stage7-platform-withdraw-ready'");
    expect(app).toContain("testId: `stage9-demo-sample-platform-announcement-${announcement.id}`");
  });

  it('records the fourth stage-nine increment in the checklist', () => {
    const checklist = read('docs/stage-nine-execution-checklist.md');

    expect(checklist).toContain('| 4 | 推荐演示样本卡片高亮第一轮 |');
    expect(checklist).toContain('推荐演示样本');
    expect(checklist).toContain('scripts/stage-nine-demo-sample-card-highlight-ui.test.ts');
  });
});
