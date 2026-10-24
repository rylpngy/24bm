import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QualificationSupplementPanel } from './qualification-supplement-panel';
const fixture = vi.hoisted(() => ({ manage: true, error: false, request: vi.fn().mockResolvedValue({}) }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => fixture.manage }) }));
vi.mock('@24bid/api-client', () => ({
  qualificationSupplements: async () => { if (fixture.error) throw Error('denied'); return { items: [], total: 0 }; },
  requestQualificationSupplement: fixture.request, cancelQualificationSupplement: vi.fn(),
  useBuyerSupplierList: () => ({ data: { data: [{ id: 'relation', supplierName: '合作供应商' }] } }),
  buyerQualificationArchive: async () => [{ id: 'old', qualificationType: '营业执照', status: 'active' }],
}));
afterEach(cleanup);
beforeEach(() => { fixture.manage = true; fixture.error = false; fixture.request.mockClear(); });
const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><QualificationSupplementPanel relationId="relation" /></QueryClientProvider>);
it('collects the target original, deadline and material requirements without changing cooperation status', async () => {
  show(); fireEvent.click(screen.getByRole('button', { name: '发起补件' })); await screen.findByRole('option', { name: /营业执照/ });
  fireEvent.change(screen.getByLabelText('补件证照'), { target: { value: 'old' } }); fireEvent.change(screen.getByLabelText('补件期限'), { target: { value: new Date().toISOString().slice(0, 10) } });
  fireEvent.change(screen.getByLabelText('补件原因'), { target: { value: '请补充有效原件' } }); fireEvent.click(screen.getByRole('button', { name: '发送补件任务' }));
  await waitFor(() => expect(fixture.request).toHaveBeenCalledWith({ relationId: 'relation', qualificationId: 'old', reason: '请补充有效原件', dueDate: expect.any(String) }));
});
it('does not expose task creation to a reader', async () => { fixture.manage = false; show(); expect(await screen.findByText('暂无补件任务。')).toBeTruthy(); expect(screen.queryByRole('button', { name: '发起补件' })).toBeNull(); });
it('shows failed loading instead of an empty task list', async () => { fixture.error = true; show(); expect(await screen.findByText('补件台账加载失败，请刷新重试。')).toBeTruthy(); expect(screen.queryByText('暂无补件任务。')).toBeNull(); });
