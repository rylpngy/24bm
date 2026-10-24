import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { AnnouncementsPage } from './announcements-page';
const state = vi.hoisted(() => ({ error: false }));
vi.mock('@24bid/api-client', () => ({
  usePlatformAnnouncementList: () => ({ data: { data: [{ id: 'a', title: '历史公告', audience: 'buyer', content: '内容', status: 'active' }] } }),
  usePlatformAnnouncementPublish: () => ({ mutate: vi.fn() }),
  usePlatformAnnouncementWithdraw: () => ({ mutate: vi.fn() }),
  useDictionaryList: (params: { type: string; includeInactive?: boolean }) => ({ isError: state.error, data: { data: params.includeInactive ? [{ code: 'buyer', label: '采购企业旧标签' }] : params.type === 'announcement_audience' ? [{ code: 'supplier', label: '供方企业' }] : [] } }),
}));
afterEach(() => { cleanup(); state.error = false; });
const show = () => render(<QueryClientProvider client={new QueryClient()}><AnnouncementsPage canManage /></QueryClientProvider>);
it('uses active dictionary choices but retains labels for historical inactive audiences', () => {
  show(); fireEvent.click(screen.getByRole('button', { name: '发布公告' }));
  expect(screen.getByRole('option', { name: '供方企业' })).toHaveValue('supplier');
  expect(screen.queryByRole('option', { name: '采购方' })).toBeNull();
  expect(screen.getByText(/受众 采购企业旧标签/)).toBeTruthy();
});
it('does not allow publishing when the dictionary is unavailable', () => {
  state.error = true; show(); fireEvent.click(screen.getByRole('button', { name: '发布公告' }));
  expect(screen.getByRole('alert')).toHaveTextContent('受众选项加载失败');
  expect(screen.getAllByRole('button', { name: '发布公告' }).at(-1)).toBeDisabled();
});
