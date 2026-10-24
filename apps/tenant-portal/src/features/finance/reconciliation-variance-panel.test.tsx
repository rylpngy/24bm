import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { ReconciliationVariancePanel } from './reconciliation-variance-panel';

const state = vi.hoisted(() => ({ handling: false, manage: true, resolve: vi.fn() }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => state.manage }) }));
vi.mock('@24bid/api-client', () => ({
  useBuyerFinanceActionThreeWayMatches: () => ({ data: { data: [
    { id: 'm', invoiceId: 'i', orderId: 'o', matchStatus: '履约待核验', blockingReason: '退换货处置尚未确认解决' },
  ] } }),
  useBuyerFinanceActionVarianceHandlings: () => ({ data: { data: state.handling ? [
    { id: 'v', invoiceId: 'i', status: '待处理' },
  ] : [] } }),
  useBuyerFinanceActionCreateVarianceHandlingFromThreeWayMatch: () => ({}),
  useBuyerFinanceActionUpdateVarianceHandlingStatus: () => ({ mutate: state.resolve }),
  useBuyerFinanceActionApproveVarianceHandling: () => ({}),
}));
beforeEach(() => { state.handling = false; state.manage = true; state.resolve.mockReset(); });
function show() {
  render(<QueryClientProvider client={new QueryClient()}><ReconciliationVariancePanel focusInvoiceId="i" /></QueryClientProvider>);
}
it('provides an actual resolution entry for a quantity or return blocker', () => {
  show();
  expect(screen.getByRole('button', { name: '登记差异处理' })).toBeTruthy();
});
it('requires an operator supplied disposition result instead of fabricating adjustment evidence', () => {
  state.handling = true; show();
  const input = screen.getByRole('textbox', { name: '处置结果 v' });
  const button = screen.getByRole('button', { name: '标记已处理(超 ¥1万转签核)' });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(input, { target: { value: '退货两件已换货并复验，凭据 R-2' } });
  fireEvent.click(button);
  expect(state.resolve).toHaveBeenCalledWith(expect.objectContaining({ data: {
    status: '已处理', result: '退货两件已换货并复验，凭据 R-2',
  } }), expect.anything());
});
it('does not offer resolution mutations to a reader', () => {
  state.manage = false; show();
  expect(screen.queryByRole('button', { name: '登记差异处理' })).toBeNull();
});
