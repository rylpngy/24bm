import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { App } from '../../App';

const state = vi.hoisted(() => ({ granted: ['platform:*'] }));
vi.mock('../../lib/auth-store', () => ({
  useAuthStore: (select: (value: unknown) => unknown) => select({ session: { userId: 'admin', displayName: 'Admin' } }),
}));
vi.mock('@24bid/api-client', async original => ({
  ...await original<typeof import('@24bid/api-client')>(),
  useSessionPermissions: () => ({ data: { data: { permissions: state.granted } } }),
}));
vi.mock('@24bid/ui', async original => ({
  ...await original<typeof import('@24bid/ui')>(),
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('./public-catalog-reviews-page', () => ({ PublicCatalogReviewsPage: ({ canManage }: { canManage: boolean }) => <div data-testid="public-catalog-permission">{String(canManage)}</div> }));
vi.mock('../announcements/announcements-page', () => ({ AnnouncementsPage: () => <div>公告只读</div> }));
beforeEach(() => { state.granted = ['platform:*']; window.history.replaceState(null, '', '/?module=mall'); });
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });

it('opens the catalog review page from the real app deep link with explicit reviewer permission', () => {
  render(<App />);
  expect(screen.getByTestId('public-catalog-permission')).toHaveTextContent('true');
});

it('does not expose the catalog review page to a supplier account', () => {
  state.granted = ['supplier:*'];
  render(<App />);
  expect(screen.queryByTestId('public-catalog-permission')).toBeNull();
});

it('does not expose catalog review through a deep link for a restricted platform account', () => {
  state.granted = ['platform:announcement:read'];
  render(<App />);
  expect(screen.queryByTestId('public-catalog-permission')).toBeNull();
  expect(screen.getByText('公告只读')).toBeTruthy();
});
