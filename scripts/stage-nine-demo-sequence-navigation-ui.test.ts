import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage nine demo sequence navigation UI', () => {
  it('adds reusable sequence navigation controls to the demo command center', () => {
    const panel = read('components/stageEightDemoPanels.tsx');

    expect(panel).toContain('export type DemoSequenceNavigation<ModuleId extends string>');
    expect(panel).toContain('sequenceNavigation?: DemoSequenceNavigation<string>');
    expect(panel).toContain('data-testid="stage9-demo-sequence-navigation"');
    expect(panel).toContain('data-testid="stage9-demo-previous-page"');
    expect(panel).toContain('data-testid="stage9-demo-next-page"');
    expect(panel).toContain('data-testid="stage9-demo-locate-sample"');
    expect(panel).toContain('定位推荐样本');
  });

  it('wires buyer, supplier, and platform command centers to sequence navigation', () => {
    const app = read('App.tsx');

    expect(app).toContain('buildDemoSequenceNavigation(');
    expect(app).toContain('sequenceNavigation={buyerDemoSequenceNavigation}');
    expect(app).toContain('sequenceNavigation={supplierDemoSequenceNavigation}');
    expect(app).toContain('sequenceNavigation={platformDemoSequenceNavigation}');
    expect(app).toContain('const supplierDemoWalkthroughSteps: Array<DemoWalkthroughStep<SupplierAdminModule>>');
  });

  it('locates current-page recommended samples by role without adding routes', () => {
    const app = read('App.tsx');

    expect(app).toContain('const locateBuyerDemoSample = () => {');
    expect(app).toContain("setSelectedDemandId('dem-stage7-submit-ready')");
    expect(app).toContain("setSelectedRfqId('rfq-stage7-award-ready')");
    expect(app).toContain("setSelectedSupplierOrderId('po-stage7-supplier-confirm-ready')");
    expect(app).toContain("setSelectedSupplierInvoiceId('inv-stage7-supplier-receivable-ready')");
    expect(app).toContain("setSelectedPlatformTenantId('tenant-stage7-platform-action')");
    expect(app).toContain("setSelectedPlatformReviewId('ent-stage7-platform-review-ready')");
    expect(app).toContain('scrollToStageNineDemoSample(');
    expect(app).not.toContain('react-router-dom');
  });

  it('records the sixth stage-nine increment in the checklist', () => {
    const checklist = read('docs/stage-nine-execution-checklist.md');

    expect(checklist).toContain('| 6 | 演示顺序导航和当前页样本定位第一轮 |');
    expect(checklist).toContain('上一页、下一页、定位推荐样本');
    expect(checklist).toContain('scripts/stage-nine-demo-sequence-navigation-ui.test.ts');
  });
});
