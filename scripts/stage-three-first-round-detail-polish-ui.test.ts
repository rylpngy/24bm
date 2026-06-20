import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('stage three first round detail polish UI', () => {
  it('turns the workspace hero into a compact admin summary band', () => {
    const app = read('App.tsx');
    const heroBand = sliceBetween(app, 'const HeroBand', 'const MetricCard');

    expect(heroBand).toContain('aria-label={`${eyebrow} 页面摘要`}');
    expect(heroBand).toContain('bg-slate-50/80');
    expect(heroBand).toContain('lg:grid-cols-[minmax(0,1fr)_auto]');
    expect(heroBand).toContain('流程边界');
    expect(heroBand).toContain('grid-cols-2 sm:flex');
    expect(heroBand).not.toContain('Phase 1 MVP');
    expect(heroBand).not.toContain('bg-slate-950');
  });

  it('makes module headers feel like dense back-office control headers', () => {
    const app = read('App.tsx');
    const buyerHeader = sliceBetween(app, 'const BuyerModuleHeader', 'const SupplierModuleHeader');
    const supplierHeader = sliceBetween(app, 'const SupplierModuleHeader', 'const PlatformModuleHeader');
    const platformHeader = sliceBetween(app, 'const PlatformModuleHeader', 'const ListToolbar');

    for (const header of [buyerHeader, supplierHeader, platformHeader]) {
      expect(header).toContain('border-l-4');
      expect(header).toContain('lg:w-72');
      expect(header).toContain('self-stretch');
      expect(header).toContain('overflow-hidden');
      expect(header).toContain('minmax(0,1fr)');
    }
  });

  it('adds professional card focus states and icon-led detail actions', () => {
    const app = read('App.tsx');
    const workflowCard = sliceBetween(app, 'const WorkflowListCard', 'const SimpleList');
    const adminInfoCard = sliceBetween(app, 'const AdminInfoCard', 'const InlineWorkflowAction');
    const detailToggle = sliceBetween(app, 'const DetailToggleButton', 'const TableDetailButton');
    const tableDetail = sliceBetween(app, 'const TableDetailButton', 'const PrimaryActionButton');

    expect(app).toContain('Eye');
    expect(workflowCard).toContain('aria-label={`${title} 工作流卡片`}');
    expect(workflowCard).toContain('focus-within:ring-2');
    expect(workflowCard).toContain('hover:-translate-y-0.5');
    expect(adminInfoCard).toContain('focus-within:ring-2');
    expect(adminInfoCard).toContain('hover:border-blue-200');
    expect(detailToggle).toContain('<Eye size={14}');
    expect(detailToggle).toContain('min-w-[5.5rem]');
    expect(tableDetail).toContain('<Eye size={14}');
    expect(tableDetail).toContain('min-w-[5.5rem]');
  });

  it('keeps repeated facts readable but denser on desktop', () => {
    const app = read('App.tsx');
    const inlineFactGrid = sliceBetween(app, 'const InlineFactGrid', 'const nextActionToneClasses');
    const miniFact = sliceBetween(app, 'const MiniFact', 'const DetailKeyValueRow');

    expect(inlineFactGrid).toContain('grid-cols-2 xl:grid-cols-4');
    expect(inlineFactGrid).toContain('rounded-md');
    expect(inlineFactGrid).toContain('min-w-0');
    expect(miniFact).toContain('border border-slate-100');
    expect(miniFact).toContain('bg-white/80');
  });
});
