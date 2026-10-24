import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SupplierPerformanceBoard } from './supplier-performance-board';
const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@24bid/api-client', async importOriginal => ({ ...await importOriginal<object>(), listSupplierPerformanceComparison: api.list }));
const row = { relationId: 'r1', supplierId: 's1', supplierName: '零分供应商', evaluationId: 'e1', totalScore: 0, qualityScore: 0, deliveryScore: 0, priceScore: 0, serviceScore: 0, receiptCount: 2, scheduledReceiptCount: 1, onTimeCount: 0, onTimeRate: 0, totalReceived: 10, totalQualified: 0, qualifiedRate: 0 };
beforeEach(() => { vi.resetAllMocks(); api.list.mockResolvedValue({ data: [row, { ...row, relationId: 'r2', supplierName: '未考核供应商', evaluationId: null, totalScore: null }, { ...row, relationId: 'r3', supplierName: '满分供应商', totalScore: 100 }] }); });
afterEach(cleanup);
function show() { const open = vi.fn(); render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SupplierPerformanceBoard onOpen={open} /></QueryClientProvider>); return open; }
it('defaults to this quarter, ranks zero but not unevaluated rows, opens relation ID', async () => {
  const open = show(); await screen.findByText('零分供应商');
  const now = new Date(); expect(api.list.mock.calls[0][0]).toBe(`${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`);
  expect(screen.getByText('未考核')).toBeTruthy();
  expect(screen.getByLabelText('已考核数量').textContent).toBe('2');
  expect(screen.getByLabelText('平均绩效').textContent).toBe('50');
  expect(screen.getByText('排名 2 · 综合 0')).toBeTruthy();
  expect(screen.getAllByText('本期已登记收货准时率：0%')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: '查看零分供应商' })); expect(open).toHaveBeenCalledWith('r1');
});
it('queries each valid period, blocks invalid periods and hides failed cached data', async () => {
  show(); await screen.findByText('零分供应商');
  fireEvent.change(screen.getByLabelText('考核周期'), { target: { value: '2025' } });
  await waitFor(() => expect(api.list.mock.calls.some(call => call[0] === '2025')).toBe(true));
  fireEvent.change(screen.getByLabelText('考核周期'), { target: { value: '2025-13' } });
  expect(screen.queryByText('零分供应商')).toBeNull();
  const count = api.list.mock.calls.length;
  expect(screen.getByText(/有效的比较周期/)).toBeTruthy(); expect(api.list).toHaveBeenCalledTimes(count);
  fireEvent.change(screen.getByLabelText('考核周期'), { target: { value: '2025-01' } }); await screen.findByText('零分供应商');
  api.list.mockRejectedValueOnce(new Error('failed'));
  fireEvent.click(screen.getByRole('button', { name: '刷新绩效' }));
  await screen.findByText(/绩效加载失败/); expect(screen.queryByText('零分供应商')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试' })); await screen.findByText('零分供应商');
});
it('paginates and resets pagination on search', async () => {
  api.list.mockResolvedValue({ data: Array.from({ length: 9 }, (_, i) => ({ ...row, relationId: `r${i}`, supplierName: `企业${i}` })) });
  show(); await screen.findByText('企业0'); expect(screen.queryByText('企业8')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /下一页/ })); expect(screen.getByText('企业8')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('搜索供应商'), { target: { value: '企业0' } }); expect(screen.getByText('企业0')).toBeTruthy();
});
