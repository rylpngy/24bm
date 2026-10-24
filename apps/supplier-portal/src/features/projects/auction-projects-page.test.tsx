import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { AuctionProjectsPage } from './auction-projects-page';

vi.mock('../../lib/auth-store', () => ({
  useAuthStore: (select: (state: unknown) => unknown) => select({ session: { supplierId: 's1', token: 'token' } }),
}));
vi.mock('@24bid/api-client', () => ({
  useAuctionStream: () => ({ live: true }),
  useSupplierQuoteListRfqs: () => ({ data: { data: [{ id: 'r', title: '待开始竞价', method: '竞价',
    status: '报价中', auctionPlannedStart: '2099-01-01T00:00:00Z', deadlineAt: '2099-01-02T00:00:00Z',
    currentRound: 2, invitedSupplierIds: ['s1'], quotes: [],
  }] } }),
}));

it('uses current-round own quotes and does not call a scheduled auction live', () => {
  render(<QueryClientProvider client={new QueryClient()}>
    <AuctionProjectsPage onOpenProject={vi.fn()} />
  </QueryClientProvider>);
  expect(screen.queryByText('LIVE 竞价中')).not.toBeInTheDocument();
  expect(screen.getAllByText('待开始').length).toBeGreaterThan(0);
  expect(screen.queryByText('¥90.00')).not.toBeInTheDocument();
});
