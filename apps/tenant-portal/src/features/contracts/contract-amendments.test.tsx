import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { ContractAmendments } from './contract-amendments';

const state = vi.hoisted(() => ({ manage: false, failed: false }));
vi.mock('../../lib/use-buyer-permissions', () => ({
  useBuyerPermissions: () => ({ can: () => state.manage }),
}));
vi.mock('@24bid/api-client', () => ({
  useBuyerContractCreateAmendment: () => ({}),
  useBuyerContractListAmendments: () => ({
    isError: state.failed, error: new Error('合同无权访问'),
    data: { data: [{ id: 'a1', seq: 1, reason: 'cached-secret' }] },
  }),
}));
beforeEach(() => { state.manage = false; state.failed = false; });
function show(status = '已生效', archiveStatus = '未归档') {
  render(<QueryClientProvider client={new QueryClient()}>
    <ContractAmendments contractId="c1" status={status} archiveStatus={archiveStatus} />
  </QueryClientProvider>);
}
it('does not offer amendment writes to a read-only account', () => {
  show();
  expect(screen.queryByRole('button', { name: '登记变更' })).toBeNull();
});
it('locks amendments during approval and after archive', () => {
  state.manage = true; show('审批中');
  expect(screen.queryByRole('button', { name: '登记变更' })).toBeNull();
});
it('does not offer amendments for an archived effective contract', () => {
  state.manage = true; show('已生效', '已归档');
  expect(screen.queryByRole('button', { name: '登记变更' })).toBeNull();
});
it('offers controlled amendments for an effective contract to a manager', () => {
  state.manage = true; show();
  expect(screen.getByRole('button', { name: '登记变更' })).toBeTruthy();
});
it('hides cached amendment records after record access is denied', () => {
  state.failed = true; show();
  expect(screen.queryByText('cached-secret')).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('合同无权访问');
});
