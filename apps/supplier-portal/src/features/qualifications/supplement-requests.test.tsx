import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SupplementRequests } from './supplement-requests';
const fixture = vi.hoisted(() => ({ reply: vi.fn().mockResolvedValue({}), status: 'requested' }));
vi.mock('@24bid/api-client', () => ({
  qualificationSupplements: async () => ({ items: [{ id: 'task', tenantName: '采购企业', qualificationId: 'old', qualificationType: '营业执照', reason: '请补有效证照', dueDate: '2026-10-24', status: fixture.status, revision: 4 }], total: 1 }),
  replyQualificationSupplement: fixture.reply,
}));
afterEach(cleanup);
beforeEach(() => { fixture.status = 'requested'; fixture.reply.mockClear(); });
function show(canManage = true) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SupplementRequests canManage={canManage} qualifications={[{ id: 'new', qualificationType: '营业执照', status: 'active', fileName: '新原件.pdf' }]} /></QueryClientProvider>); }
it('submits a new archived qualification and optimistic revision with the supplier response', async () => {
  show(); fireEvent.click(await screen.findByRole('button', { name: '提交补件回复' }));
  fireEvent.change(screen.getByLabelText('补件新版原件'), { target: { value: 'new' } }); fireEvent.change(screen.getByLabelText('补件回复说明'), { target: { value: '已补有效原件' } });
  fireEvent.click(screen.getByRole('button', { name: '确认提交补件' }));
  await waitFor(() => expect(fixture.reply).toHaveBeenCalledWith('task', { replacementId: 'new', response: '已补有效原件', revision: 4 }));
});
it('does not offer resubmission for a task already pending buyer approval', async () => {
  fixture.status = 'submitted'; show(); expect(await screen.findByText('已提交待采购方审批')).toBeTruthy(); expect(screen.queryByRole('button', { name: '提交补件回复' })).toBeNull();
});
it('allows readers to see requirements without offering a reply action', async () => {
  show(false); expect(await screen.findByText('请补有效证照')).toBeTruthy(); expect(screen.queryByRole('button', { name: '提交补件回复' })).toBeNull();
});
