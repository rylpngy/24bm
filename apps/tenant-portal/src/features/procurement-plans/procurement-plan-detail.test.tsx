import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PlanDetail } from './procurement-plans-page';
vi.mock('./procurement-execution-panel', () => ({ ProcurementExecutionPanel: () => <div>执行归档台账</div> }));
afterEach(cleanup);
const props = { index: 0, demands: [], supplierNames: {}, materialNames: {}, departmentNames: {}, onBack: vi.fn(), onNavigate: vi.fn() };
it('navigates to the actual RFQ detail instead of an unimplemented quotes module', () => {
  render(<PlanDetail {...props} plan={{ id: 'rfq/1', title: '项目', status: '定标审批中' }} />);
  expect(screen.getByRole('link', { name: /前往报价对比/ }).getAttribute('href')).toBe('?module=rfqs&recordId=rfq%2F1');
  expect(screen.queryByText(/免审直通/)).toBeNull();
});
it('shows the unified execution archive and opens the linked order directly', () => {
  render(<PlanDetail {...props} plan={{ id: 'rfq1', status: '已定标' }} order={{ id: 'o/1', status: '已收货' }} />);
  expect(screen.getByRole('link', { name: '查看采购订单' }).getAttribute('href')).toBe('?module=orders&recordId=o%2F1');
  expect(screen.getByText('执行归档台账')).toBeTruthy();
  expect(screen.queryByText('验收归档')).toBeNull();
});
