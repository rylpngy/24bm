import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('admin list toolbar UI', () => {
  it('uses a shared toolbar for high-frequency admin lists', () => {
    const app = read('App.tsx');

    expect(app).toContain('const ListToolbar');
    expect(app).toContain('recordCount: number');
    expect(app).toContain('filterLabel: string');
    expect(app).toContain('actionLabel?: string');
    expect(app).toContain('共 {recordCount} 条');
    expect(app).toContain('当前筛选：{filterLabel}');
    expect(app).toContain('<Search size={16}');
  });

  it('adds list toolbar context to buyer demand, platform tenant, and supplier opportunity lists', () => {
    const app = read('App.tsx');

    expect(app).toContain('title="需求池"');
    expect(app).toContain('recordCount={workspace.demands.length}');
    expect(app).toContain('filterLabel="全部需求状态"');
    expect(app).toContain('actionLabel="新建需求"');

    expect(app).toContain('title="租户运营列表"');
    expect(app).toContain('recordCount={platformTenants.length}');
    expect(app).toContain('filterLabel="全部采购企业租户"');
    expect(app).toContain('actionLabel="租户配置"');

    expect(app).toContain('title="询价邀请池"');
    expect(app).toContain('recordCount={workspace.opportunities.length}');
    expect(app).toContain('filterLabel="待报价优先"');
    expect(app).toContain('actionLabel="批量响应预留"');
  });
});
