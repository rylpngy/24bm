import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { App } from '../../App';

const state = vi.hoisted(() => ({ granted: ['supplier:mall:read'] }));
vi.mock('../../lib/auth-store', () => ({
  useAuthStore: (select: (value: unknown) => unknown) => select({ session: { userId: 'u', supplierId: 's', displayName: 'Supplier' } }),
}));
vi.mock('@24bid/api-client', async original => ({
  ...await original<typeof import('@24bid/api-client')>(),
  useSessionPermissions: () => ({ data: { data: { permissions: state.granted } } }),
}));
vi.mock('@24bid/ui', async original => ({
  ...await original<typeof import('@24bid/ui')>(),
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('./shelf-page', () => ({ ShelfPage: ({ canManage }: { canManage: boolean }) => <div data-testid="shelf-permission">{String(canManage)}</div> }));
beforeEach(() => { state.granted = ['supplier:mall:read']; window.history.replaceState(null, '', '/?module=shelf'); });
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });

it('passes read-only shelf permissions from the real app', () => {
  render(<App />);
  expect(screen.getByTestId('shelf-permission')).toHaveTextContent('false');
});

it('passes manage permission instead of relying on a permissive default', () => {
  state.granted.push('supplier:mall:manage');
  render(<App />);
  expect(screen.getByTestId('shelf-permission')).toHaveTextContent('true');
});
