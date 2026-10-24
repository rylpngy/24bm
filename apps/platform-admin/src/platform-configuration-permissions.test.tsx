import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { App } from './App';

const state = vi.hoisted(() => ({ granted: ['platform:tenant:read'] }));
vi.mock('./lib/auth-store', () => ({ useAuthStore: (select: (value: unknown) => unknown) =>
  select({ session: { userId: 'operator', displayName: 'Operator' } }) }));
vi.mock('@24bid/api-client', async original => ({ ...await original<typeof import('@24bid/api-client')>(),
  useSessionPermissions: () => ({ data: { data: { permissions: state.granted } } }),
}));
vi.mock('@24bid/ui', async original => ({ ...await original<typeof import('@24bid/ui')>(),
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('./features/tenants/tenants-page', () => ({ TenantsPage: (props: unknown) => <div data-testid="tenant-permissions">{JSON.stringify(props)}</div> }));
vi.mock('./features/settings/dictionaries-page', () => ({ DictionariesPage: (props: unknown) => <div data-testid="dictionary-permissions">{JSON.stringify(props)}</div> }));
beforeEach(() => { state.granted = ['platform:tenant:read']; window.history.replaceState(null, '', '/?module=tenants'); });
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });

it('passes explicit read-only tenant capabilities from the actual session', () => {
  render(<App />);
  expect(JSON.parse(screen.getByTestId('tenant-permissions').textContent!))
    .toEqual({ canManage: false, canReadUsage: false, canCreateSupplier: false });
});
it('keeps usage and supplier onboarding permissions independent from tenant management', () => {
  state.granted = ['platform:tenant:read', 'platform:tenant:manage', 'platform:billing:read'];
  render(<App />);
  expect(JSON.parse(screen.getByTestId('tenant-permissions').textContent!))
    .toEqual({ canManage: true, canReadUsage: true, canCreateSupplier: false });
});
it('passes dictionary read access without write capability', () => {
  state.granted = ['platform:dictionary:read']; window.history.replaceState(null, '', '/?module=settings');
  render(<App />);
  expect(screen.getByTestId('dictionary-permissions')).toHaveTextContent('"canManage":false');
});
it('full platform administrators retain the existing management functions', () => {
  state.granted = ['platform:*']; render(<App />);
  expect(JSON.parse(screen.getByTestId('tenant-permissions').textContent!))
    .toEqual({ canManage: true, canReadUsage: true, canCreateSupplier: true });
});
