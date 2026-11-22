import {describe,it,expect} from 'vitest';
import {monthCells,workbenchModules,workbenchHref} from './workbench-model';
describe('agency workbench routes and calendar',()=>{
 it('exposes independent business modules and removes purchasing entry points',()=>{
  const ids=workbenchModules.map(m=>m.id);
  expect(ids).toEqual(expect.arrayContaining(['agency','documents','templates','announcements','execution','contracts','fees','approvals']));
  for(const removed of ['demands','materials','procurement-plans','mall','orders','rfqs','auctions'])expect(ids).not.toContain(removed);
 });
 it('lays out leap February and a December crossing without missing or repeated days',()=>{
  const leap=monthCells('2028-02');expect(leap).toHaveLength(42);expect(new Set(leap).size).toBe(42);expect(leap).toContain('2028-02-29');expect(leap[0]).toBe('2028-01-31');
  const december=monthCells('2026-12');expect(december).toContain('2027-01-01');expect(december.filter(d=>d.startsWith('2026-12'))).toHaveLength(31);
 });
 it('keeps linked project identifiers and tabs in module routes',()=>{
  const q=new URL(workbenchHref('documents','a b','documents'),'http://localhost').searchParams;
  expect(q.get('module')).toBe('documents');expect(q.get('recordId')).toBe('a b');expect(q.get('tab')).toBe('documents');
 });
});
