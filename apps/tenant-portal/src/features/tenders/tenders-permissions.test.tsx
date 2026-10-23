import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { TendersPage } from './tenders-page';

const state = vi.hoisted(() => ({ manage: false, failed: false, suppliersEnabled: false }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => state.manage }) }));
vi.mock('@24bid/api-client', async (original) => {
  const api = await original<Record<string, unknown>>();
  const mocks: Record<string, unknown> = {};
  for (const name of ['Create', 'Update', 'Publish', 'Distribute', 'Open', 'Fail', 'Rebid', 'SetPrequalificationRequired', 'ReviewPrequalification']) {
    mocks[`useBuyerTender${name}`] = () => ({});
  }
  return { ...api, ...mocks,
    useBuyerTenderList: () => ({ isError: state.failed, data: { data: [{ id: 't-1', title: '只读招标', status: '编制中', tenderNo: 'T001' }] } }),
    useBuyerSupplierList: (_: unknown, options: { query: { enabled: boolean } }) => {
      state.suppliersEnabled = options.query.enabled;
      return { data: { data: [] } };
    },
  };
});
afterEach(() => { cleanup(); state.manage = false; state.failed = false; });
const show = () => render(<QueryClientProvider client={new QueryClient()}><TendersPage /></QueryClientProvider>);

it('does not expose edit or create actions to read-only users', () => {
  show();
  expect(screen.getAllByText('只读招标').length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: /新建/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /编辑/ })).toBeNull();
  expect(state.suppliersEnabled).toBe(false);
});

it('shows a failure instead of cached tender data', () => {
  state.failed = true;
  show();
  expect(screen.queryByText('只读招标')).toBeNull();
  expect(screen.getByText(/加载失败/)).toBeTruthy();
});
