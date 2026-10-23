import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('./lib/auth-store', () => ({
  useAuthStore: (select: (state: { session: { displayName: string; tenantId: string } }) => unknown) =>
    select({ session: { displayName: 'Tester', tenantId: 'test' } }),
}));
vi.mock('@24bid/api-client', () => ({
  useSessionPermissions: () => ({ data: { data: { permissions: ['buyer:*'] } } }),
  useBuyerCapabilityCapabilities: () => ({ data: { data: { moduleIds: [], methodGatedModuleIds: [] } } }),
}));
vi.mock('./features/portal/portal-landing', () => ({ PortalLanding: () => <div>登录</div> }));
vi.mock('./features/dashboard/dashboard-page', () => ({
  DashboardPage: ({ onNavigate }: { onNavigate: (id: string) => void }) =>
    <button onClick={() => onNavigate('demands')}>前往需求</button>,
}));
vi.mock('./features/demands/demands-page', () => ({ DemandsPage: () => <div>需求模块已加载</div> }));

afterEach(() => window.history.replaceState(null, '', '/'));

it('lazy loads the requested module and follows browser back without stale record ids', async () => {
  window.history.replaceState(null, '', '/?module=dashboard&recordId=obsolete');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: '前往需求' }));
  expect(await screen.findByText('需求模块已加载')).toBeTruthy();
  expect(new URLSearchParams(window.location.search).get('module')).toBe('demands');
  expect(new URLSearchParams(window.location.search).get('recordId')).toBeNull();
  window.history.back();
  await waitFor(() => expect(screen.getByRole('button', { name: '前往需求' })).toBeTruthy());
});
