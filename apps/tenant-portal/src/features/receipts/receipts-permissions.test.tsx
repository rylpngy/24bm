import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { ReceiptsPage } from './receipts-page';

const access = vi.hoisted(() => ({ write: false }));
vi.mock('../../lib/use-buyer-permissions', () => ({
  useBuyerPermissions: () => ({ can: (permission: string) => permission !== 'buyer:receipt:manage' || access.write }),
}));
vi.mock('@24bid/api-client', () => ({
  usePurchaseOrderList: () => ({ data: { data: [{ id: 'po-visible', status: '已发货', amount: 100 }] } }),
  useBuyerReceiptList: () => ({ data: { data: [] } }),
  useBuyerDeliveryList: () => ({ data: { data: [] } }),
  useBuyerSupplierList: () => ({ data: { data: [] } }),
  useBuyerReceiptCreate: () => ({}),
}));
afterEach(() => { cleanup(); access.write = false; });
const show = () => render(<QueryClientProvider client={new QueryClient()}><ReceiptsPage /></QueryClientProvider>);

it('shows pending orders but disables receipt registration for read-only accounts', () => {
  show();
  const buttons = screen.getAllByTitle('当前账号仅可查看') as HTMLButtonElement[];
  expect(buttons.length).toBeGreaterThan(0);
  expect(buttons.every(button => button.disabled)).toBe(true);
});

it('enables receipt registration only with the dedicated action permission', () => {
  access.write = true;
  show();
  expect((screen.getAllByTitle('登记收货验收') as HTMLButtonElement[]).every(button => !button.disabled)).toBe(true);
});
