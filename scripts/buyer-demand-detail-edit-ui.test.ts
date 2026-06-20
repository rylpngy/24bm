import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer demand detail edit UI', () => {
  it('adds an editable demand detail form with Java save and refresh feedback', () => {
    const app = read('App.tsx');
    const demandDetail = app.slice(
      app.indexOf('const DemandDetailPanelView'),
      app.indexOf('const DemandDetailOperationPanel'),
    );
    const buyerWorkspace = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const DemandDetailPanelView'),
    );

    expect(app).toContain('updateBuyerDemand');
    expect(app).toContain('demandUpdateBusyId');
    expect(app).toContain('updateBuyerDemandDetail');
    expect(buyerWorkspace).toContain('onUpdateDemand={onUpdateDemand}');
    expect(demandDetail).toContain('需求编辑');
    expect(demandDetail).toContain('保存需求修改');
    expect(demandDetail).toContain('刷新后回显');
    expect(demandDetail).toContain('只能编辑草稿需求');
    expect(demandDetail).toContain('editableDemandTitle');
    expect(demandDetail).toContain('editableDemandBudget');
    expect(demandDetail).toContain('editableDemandDepartment');
    expect(demandDetail).toContain('editableDemandLineItems');
    expect(demandDetail).toContain('onUpdateDemand(demand.id');
  });
});
