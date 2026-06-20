import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('mobile layout overflow UI', () => {
  it('keeps the admin shell and header controls bounded on narrow viewports', () => {
    const app = read('App.tsx');

    const appShell = sliceBetween(app, 'return (\n    <div className="flex h-dvh', 'const AppSidebar');
    expect(appShell).toContain('overflow-x-hidden');
    expect(appShell).toContain('w-full max-w-7xl');
    expect(appShell).not.toContain('max-w-7xl max-w-full');

    const mobileNav = sliceBetween(app, 'const MobileAdminNav', 'const AppHeader');
    expect(mobileNav).toContain('[-ms-overflow-style:none]');
    expect(mobileNav).toContain('[scrollbar-width:none]');
    expect(mobileNav).toContain('[&::-webkit-scrollbar]:hidden');

    const appHeader = sliceBetween(app, 'const AppHeader', 'const Select');
    expect(appHeader).toContain('className="flex min-w-0 flex-1 flex-wrap');
    expect(appHeader).toContain('className="relative order-last min-w-0 w-full');
    expect(appHeader).toContain('className="inline-flex h-9 min-w-0 flex-1');
    expect(appHeader).toContain('className="inline-flex h-9 min-w-0 flex-1');
  });

  it('uses mobile-safe form controls for shared filters and workspace selectors', () => {
    const app = read('App.tsx');

    const selectComponent = sliceBetween(app, 'const Select', 'type PlatformAnnouncement');
    expect(selectComponent).toContain('className="relative w-full min-w-0 sm:w-auto"');
    expect(selectComponent).toContain('className="w-full min-w-0 appearance-none');

    const statusFilter = sliceBetween(app, 'const StatusFilter', 'const FilterResultSummary');
    expect(statusFilter).toContain('className="h-9 w-full min-w-0 rounded-md');
    expect(statusFilter).toContain('sm:min-w-[12rem]');
  });

  it('keeps shared cards, module headers, and status pills resilient to long text', () => {
    const app = read('App.tsx');

    const metricCard = sliceBetween(app, 'const MetricCard', 'const BuyerModuleHeader');
    expect(metricCard).toContain('min-w-0 rounded-lg border');
    expect(metricCard).toContain('break-words text-xl font-black text-slate-950');
    expect(metricCard).not.toContain('truncate text-xl font-black');

    const buyerHeader = sliceBetween(app, 'const BuyerModuleHeader', 'const SupplierModuleHeader');
    const supplierHeader = sliceBetween(app, 'const SupplierModuleHeader', 'const PlatformModuleHeader');
    const platformHeader = sliceBetween(app, 'const PlatformModuleHeader', 'const ListToolbar');
    for (const header of [buyerHeader, supplierHeader, platformHeader]) {
      expect(header).toContain('min-w-0 self-stretch');
      expect(header).toContain('break-words text-sm font-black');
      expect(header).toContain('break-words text-sm font-semibold');
    }

    const statusPill = sliceBetween(app, 'const StatusPill', 'export default App');
    expect(statusPill).toContain('break-words');
    expect(statusPill).not.toContain('whitespace-nowrap');
  });
});
