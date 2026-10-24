import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MallPurchaseControls } from './mall-purchase-controls';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('@24bid/api-client', async original => ({
  ...await original<Record<string, unknown>>(),
  useBuyerMallCategories: () => ({ data: { data: [{ id: 'category', name: '办公用品' }] } }),
}));
vi.mock('@24bid/api-client/mall-purchasing', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  return {
    mallControlKey: ['/api/v1/buyer/mall/purchase-controls'],
    useMallPurchaseControl: (enabled = true) => useQuery({ queryKey: ['/api/v1/buyer/mall/purchase-controls'], enabled, queryFn: api.get }),
    saveMallPurchaseControl: api.put,
  };
});
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ maxCheckoutAmount: 500, categoryIds: ['category'], requireAddress: true });
  api.put.mockResolvedValue({ maxCheckoutAmount: 600, categoryIds: ['category'], requireAddress: true });
});
afterEach(cleanup);
function show(canManage = false) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MallPurchaseControls canManage={canManage} /></QueryClientProvider>);
}

it('defers GET until the drawer opens and lets readers view but not edit or save', async () => {
  show();
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '采购控制' }));
  await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue(500));
  expect(screen.getByRole('spinbutton')).toBeDisabled();
  for (const input of screen.getAllByRole('checkbox')) expect(input).toBeDisabled();
  expect(screen.queryByRole('button', { name: '保存规则' })).toBeNull();
  fireEvent.submit(screen.getByRole('form', { name: '采购控制配置' }));
  expect(api.put).not.toHaveBeenCalled();
});

it('shows save only for managers and submits the actual adjustment reason', async () => {
  show(true);
  fireEvent.click(screen.getByRole('button', { name: '采购控制' }));
  await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue(500));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '600' } });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '经确认调整限额' } });
  fireEvent.click(screen.getByRole('button', { name: '保存规则' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith({ maxCheckoutAmount: 600, categoryIds: ['category'], requireAddress: true, reason: '经确认调整限额' }, expect.anything()));
});
