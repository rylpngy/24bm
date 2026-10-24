import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App';

const capability = vi.hoisted(() => ({ moduleIds: [] as string[], methodGatedModuleIds: [] as string[], historicalModuleIds: [] as string[] }));

vi.mock('./lib/auth-store', () => ({
  useAuthStore: (select: (state: { session: { displayName: string; tenantId: string } }) => unknown) =>
    select({ session: { displayName: 'Tester', tenantId: 'test' } }),
}));
vi.mock('@24bid/api-client', () => ({
  useSessionPermissions: () => ({ data: { data: { permissions: ['buyer:*'] } } }),
  useBuyerCapabilityCapabilities: () => ({ data: { data: capability } }),
}));
vi.mock('./features/portal/portal-landing', () => ({ PortalLanding: () => <div>登录</div> }));
vi.mock('./features/dashboard/dashboard-page', () => ({
  DashboardPage: ({ onNavigate }: { onNavigate: (id: string) => void }) =>
    <button onClick={() => onNavigate('demands')}>前往需求</button>,
}));
vi.mock('./features/demands/demands-page', () => ({ DemandsPage: () => <div>需求模块已加载</div> }));
vi.mock('./features/rfqs/rfqs-page', () => ({ RfqsPage: () => <div>历史询比模块</div> }));

afterEach(() => { window.history.replaceState(null, '', '/'); capability.moduleIds = []; capability.methodGatedModuleIds = []; capability.historicalModuleIds = []; });

it('retains authorized historical navigation after new procurement methods are disabled', async () => {
  capability.methodGatedModuleIds = ['rfqs']; capability.historicalModuleIds = ['rfqs'];
  window.history.replaceState(null, '', '/?module=rfqs');
  render(<App />);
  expect(await screen.findByText('历史询比模块')).toBeTruthy();
  expect(screen.getByText('此采购方式已停止新增业务，仍可按权限查看历史资料并办理既有业务；新增操作须先由平台开通。')).toBeTruthy();
});

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
