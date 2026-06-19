import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('admin shell polish UI', () => {
  it('keeps long navigation and workspace content scrollable within the viewport', () => {
    const app = read('App.tsx');

    expect(app).toContain('h-dvh flex-col overflow-hidden');
    expect(app).toContain('min-h-0 flex-1 flex-col');
    expect(app).toContain('min-h-0 min-w-0 flex-1 overflow-y-auto');
    expect(app).toContain('overscroll-contain');
    expect(app).toContain('max-w-full');
  });

  it('prevents nested workspace scroll regions from forcing horizontal overflow', () => {
    const app = read('App.tsx');

    expect(app).toContain('flex min-h-0 flex-1 flex-col min-w-0');
    expect(app).toContain('min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain');
    expect(app).toContain('mx-auto max-w-7xl max-w-full');
  });

  it('uses shared state components for loading, errors, and empty content', () => {
    const app = read('App.tsx');

    expect(app).toContain('ShellState');
    expect(app).toContain("variant: 'loading' | 'error' | 'empty'");
    expect(app).toContain('加载失败');
    expect(app).toContain('正在加载采购工作台');
    expect(app).toContain('EmptyState');
    expect(app).toContain('variant="empty"');
  });

  it('offers a retry action from the full-screen loading failure state', () => {
    const app = read('App.tsx');
    const shellState = app.slice(
      app.indexOf('const ShellState'),
      app.indexOf('const EmptyState'),
    );

    expect(shellState).toContain('actionLabel?: string');
    expect(shellState).toContain('onAction?: () => void');
    expect(shellState).toContain('{actionLabel && onAction &&');
    expect(app).toContain('actionLabel="重新加载"');
    expect(app).toContain('onAction={() => setRefreshKey((value) => value + 1)}');
  });

  it('prevents repeated refresh clicks while workspace data is reloading', () => {
    const app = read('App.tsx');
    const appHeader = app.slice(
      app.indexOf('const AppHeader'),
      app.indexOf('const Select'),
    );

    expect(app).toContain('const [refreshBusy, setRefreshBusy] = useState(false)');
    expect(app).toContain('const triggerRefresh = () => {');
    expect(app).toContain('if (refreshBusy) return;');
    expect(app).toContain('refreshBusy={refreshBusy}');
    expect(appHeader).toContain('refreshBusy: boolean;');
    expect(appHeader).toContain('disabled={refreshBusy}');
    expect(appHeader).toContain("aria-busy={refreshBusy || undefined}");
    expect(appHeader).toContain("{refreshBusy ? '刷新中' : '刷新'}");
  });

  it('makes the header search control filter the active buyer module lists', () => {
    const app = read('App.tsx');
    const appHeader = app.slice(
      app.indexOf('const AppHeader'),
      app.indexOf('const Select'),
    );
    const buyerWorkspace = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const DemandDetailPanelView'),
    );

    expect(app).toContain('const [searchQuery, setSearchQuery] = useState');
    expect(app).toContain('searchQuery={searchQuery}');
    expect(app).toContain('setSearchQuery={setSearchQuery}');
    expect(appHeader).toContain('value={searchQuery}');
    expect(appHeader).toContain('onChange={(event) => setSearchQuery(event.target.value)}');
    expect(appHeader).toContain("aria-label=\"搜索当前工作区\"");
    expect(appHeader).toContain('清空搜索');
    expect(buyerWorkspace).toContain('searchQuery: string;');
    expect(buyerWorkspace).toContain('const normalizedSearchQuery = searchQuery.trim().toLowerCase();');
    expect(buyerWorkspace).toContain('const matchesSearchQuery = (values: Array<string | number | undefined>)');
    expect(buyerWorkspace).toContain('const filteredDemandListRows = demandListRows.filter');
    expect(buyerWorkspace).toContain('const filteredRfqListRows = rfqListRows.filter');
    expect(buyerWorkspace).toContain('const filteredSupplierRelationRows = supplierRelationRows.filter');
    expect(buyerWorkspace).toContain('const filteredMaterialRows = materialRows.filter');
    expect(buyerWorkspace).toContain('搜索匹配');
  });

  it('keeps the workspace search usable below the xl breakpoint', () => {
    const app = read('App.tsx');
    const appHeader = app.slice(
      app.indexOf('const AppHeader'),
      app.indexOf('const Select'),
    );

    expect(appHeader).not.toContain('hidden w-64 xl:block');
    expect(appHeader).toContain('relative order-last w-full');
    expect(appHeader).toContain('sm:min-w-[18rem]');
    expect(appHeader).toContain('xl:order-none xl:w-64');
    expect(appHeader).toContain('aria-label="搜索当前工作区"');
  });

  it('uses a mobile admin navigation instead of the fixed sidebar on narrow screens', () => {
    const app = read('App.tsx');
    const appSidebar = app.slice(
      app.indexOf('const AppSidebar'),
      app.indexOf('const AppHeader'),
    );
    const mobileNav = app.slice(
      app.indexOf('const MobileAdminNav'),
      app.indexOf('const AppHeader'),
    );

    expect(app).toContain('flex h-dvh flex-col overflow-hidden');
    expect(app).toContain('lg:flex-row');
    expect(app).toContain('<MobileAdminNav');
    expect(appSidebar).toContain('hidden min-h-0 shrink-0 flex-col');
    expect(appSidebar).toContain('lg:flex lg:w-72');
    expect(app).toContain('const MobileAdminNav');
    expect(mobileNav).toContain('lg:hidden');
    expect(mobileNav).toContain('overflow-x-auto');
    expect(mobileNav).toContain('aria-label="移动端角色导航"');
    expect(mobileNav).toContain('aria-label="移动端模块导航"');
  });

  it('marks active role and module navigation items for accessible admin state', () => {
    const app = read('App.tsx');

    expect(app).toContain('aria-current={roleActive ?');
    expect(app).toContain('aria-pressed={roleActive}');
    expect(app).toContain('aria-current={moduleActive ?');
    expect(app).toContain('aria-pressed={moduleActive}');
  });

  it('uses a shared accessible detail toggle for buyer list-to-detail actions', () => {
    const app = read('App.tsx');

    expect(app).toContain('const DetailToggleButton');
    expect(app).toContain('aria-current={selected ?');
    expect(app).toContain('aria-pressed={selected}');
    expect(app).toContain('const WorkflowListCard');
    expect(app).toContain('detailSelected: boolean;');
    expect(app).toContain('onSelectDetail: () => void;');
    expect(app.match(/<DetailToggleButton/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('uses a shared primary action button for buyer workflow commands', () => {
    const app = read('App.tsx');

    expect(app).toContain('const PrimaryActionButton');
    expect(app).toContain("tone?: 'blue' | 'emerald' | 'amber'");
    expect(app).toContain('aria-busy={busy || undefined}');
    expect(app.match(/<PrimaryActionButton/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it('uses a shared process state notice for handled or waiting workflow cards', () => {
    const app = read('App.tsx');

    expect(app).toContain('const ProcessStateNotice');
    expect(app).toContain("variant: 'handled' | 'waiting'");
    expect(app).toContain('流程已处理');
    expect(app).toContain('等待供应商响应');
    expect(app.match(/<ProcessStateNotice/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('uses a shared table detail button for dense buyer tables', () => {
    const app = read('App.tsx');

    expect(app).toContain('const TableDetailButton');
    expect(app).toContain('aria-current={selected ?');
    expect(app).toContain('aria-pressed={selected}');
    expect(app.match(/<TableDetailButton/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it('uses shared responsive detail panel primitives for dense detail views', () => {
    const app = read('App.tsx');

    expect(app).toContain('const DetailPanelBody');
    expect(app).toContain('className="space-y-3 sm:space-y-4"');
    expect(app).toContain('break-words');
    expect(app).toContain('min-w-0');
    expect(app.match(/<DetailPanelBody>/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it('uses shared detail row components for trace and related business sections', () => {
    const app = read('App.tsx');

    expect(app).toContain('const DetailKeyValueRow');
    expect(app).toContain('const RelatedBusinessRow');
    expect(app).toContain('fontMono?: boolean');
    expect(app.match(/<DetailKeyValueRow/g)?.length).toBeGreaterThanOrEqual(6);
    expect(app.match(/<RelatedBusinessRow/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
