import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SupplierExportControl } from './supplier-export-control';

const state = vi.hoisted(() => ({ allowed: true, download: vi.fn() }));
vi.mock('@24bid/api-client', () => ({ downloadReport: state.download }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => state.allowed }) }));
beforeEach(() => { state.allowed = true; state.download.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);

it('keeps exports out of accounts without supplier read permission', () => {
  state.allowed = false; render(<SupplierExportControl />);
  expect(screen.queryByRole('button')).toBeNull();
});

it('sends the selected ledger and validates the evaluation period', async () => {
  render(<SupplierExportControl />);
  fireEvent.change(screen.getByLabelText('台账类型'), { target: { value: 'evaluations' } });
  fireEvent.change(screen.getByLabelText('导出周期'), { target: { value: 'bad' } });
  expect(screen.getByRole('button', { name: '导出SRM台账' }).hasAttribute('disabled')).toBe(true);
  fireEvent.change(screen.getByLabelText('导出周期'), { target: { value: '2001-Q1' } });
  fireEvent.click(screen.getByRole('button', { name: '导出SRM台账' }));
  await waitFor(() => expect(state.download).toHaveBeenCalledWith('/api/v1/buyer/suppliers/export?kind=evaluations&period=2001-Q1', '同期绩效.xlsx'));
  expect(await screen.findByText('台账已下载。')).toBeTruthy();
});

it('retains a failed export for retry without reporting success', async () => {
  state.download.mockRejectedValueOnce(new Error('network')); render(<SupplierExportControl />);
  fireEvent.click(screen.getByRole('button', { name: '导出SRM台账' }));
  expect(await screen.findByText('台账导出失败，请重试。')).toBeTruthy();
  expect(screen.queryByText('台账已下载。')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '导出SRM台账' }));
  expect(await screen.findByText('台账已下载。')).toBeTruthy();
});
