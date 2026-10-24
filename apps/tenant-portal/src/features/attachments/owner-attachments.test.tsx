import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { OwnerAttachments } from './owner-attachments';

const state = vi.hoisted(() => ({ check: vi.fn(), get: vi.fn(), denied: false }));
vi.mock('../../lib/auth-store', () => ({ useAuthStore: (selector: (value: unknown) => unknown) => selector({ session: { userId: 'buyer-user' } }) }));
vi.mock('@24bid/api-client', () => ({
  useSessionPermissions: () => ({ data: { data: { permissions: [] } } }),
  axiosInstance: { get: state.get }, checkAttachmentIntegrity: state.check,
  useAttachmentList: () => ({ isError: state.denied, data: { data: [{ id: 'a1', fileName: '测试附件.txt' }] } }),
  useAttachmentCreate: () => ({}), useAttachmentCreateUploadTicket: () => ({}),
}));
beforeEach(() => { state.denied = false; state.check.mockReset(); state.get.mockReset(); });
function show() { render(<QueryClientProvider client={new QueryClient()}><OwnerAttachments ownerType="purchase_demand" ownerId="d1" /></QueryClientProvider>); }
it('reports verified integrity from the server, not file presence', async () => {
  state.check.mockResolvedValue({ data: { status: 'verified', message: '大小及SHA-256一致' } });
  show(); fireEvent.click(screen.getByRole('button', { name: '核验' }));
  await screen.findByText('大小及SHA-256一致'); expect(state.check).toHaveBeenCalledWith('a1');
});
it('keeps historical unknown integrity explicit', async () => {
  state.check.mockResolvedValue({ data: { status: 'unverified', message: '缺少上传时校验基线' } });
  show(); fireEvent.click(screen.getByRole('button', { name: '核验' }));
  await screen.findByText('缺少上传时校验基线');
});
it('clears an earlier verified result when a fresh check is denied', async () => {
  state.check.mockResolvedValueOnce({ data: { status: 'verified', message: '此前核验通过' } })
    .mockRejectedValueOnce({ response: { data: { message: '无权访问' } } });
  show(); fireEvent.click(screen.getByRole('button', { name: '核验' })); await screen.findByText('此前核验通过');
  fireEvent.click(screen.getByRole('button', { name: '核验' })); await screen.findByText('无权访问');
  expect(screen.queryByText('此前核验通过')).toBeNull();
});
it('shows a concrete download failure reason', async () => {
  state.get.mockRejectedValue({ response: { data: { message: '附件文件缺失' } } });
  show(); fireEvent.click(screen.getByRole('button', { name: '下载' })); await screen.findByText('附件文件缺失');
});
it('hides cached attachments and disables uploading after read access fails', async () => {
  state.denied = true; show();
  expect(screen.queryByText('测试附件.txt')).toBeNull();
  expect((screen.getByRole('button', { name: '上传附件' }) as HTMLButtonElement).disabled).toBe(true);
});
