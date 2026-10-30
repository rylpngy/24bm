import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InvoiceIssuanceForm } from './invoice-issuance-form';
import { invoiceLineCents } from './invoice-issuance-amount';
const mock = vi.hoisted(() => ({
  http: vi.fn(),
  reject: false,
  blockers: [] as string[],
}));
vi.mock('@24bid/api-client/http-client', () => ({ customInstance: mock.http }));
const clients: QueryClient[] = [];
beforeEach(() => {
  mock.http.mockReset();
  mock.reject = false;
  mock.blockers = [];
  mock.http.mockImplementation(async (r: { url: string; method: string }) => {
    if (r.method === 'POST') {
      if (mock.reject)
        throw {
          response: { data: { message: '本次开票数量超过剩余可开数量' } },
        };
      return { data: { id: 'invoice' } };
    }
    if (r.url.endsWith('/preview'))
      return {
        data: {
          orderId: 'order',
          orderAmount: 300,
          invoicedAmount: 0,
          remainingAmount: 300,
          lines: [
            {
              orderLineId: 'line',
              description: '电脑',
              unit: '台',
              orderedQuantity: 3,
              unitPrice: 100,
              invoicedQuantity: 0,
              remainingQuantity: 3,
            },
          ],
          blockers: mock.blockers,
        },
      };
    return { data: [] };
  });
});
afterEach(() => {
  cleanup();
  clients.forEach((c) => c.clear());
  clients.length = 0;
});
function show() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  clients.push(client);
  const saved = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <InvoiceIssuanceForm orderId="order" onSaved={saved} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
  return saved;
}
async function fill() {
  await screen.findByLabelText('电脑本次开票数量');
  fireEvent.change(screen.getByLabelText('发票号码'), {
    target: { value: 'INV-1' },
  });
  fireEvent.change(screen.getByLabelText('电脑本次开票数量'), {
    target: { value: '1' },
  });
}
it('submits only this batch quantity and exact amount while preserving zero tax', async () => {
  const saved = show();
  await fill();
  fireEvent.change(screen.getByLabelText('税率%'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: '提交开票' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const call = mock.http.mock.calls.find(([r]) => r.method === 'POST')![0];
  expect(call.data).toMatchObject({
    amount: 100,
    invoiceNo: 'INV-1',
    taxRate: 0,
    lineItems: [{ orderLineId: 'line', quantity: 1 }],
  });
  expect(call.data.requestKey).toBeTruthy();
});
it('keeps failed content and idempotency key for retry rather than creating a fresh invoice', async () => {
  const saved = show();
  mock.reject = true;
  await fill();
  fireEvent.click(screen.getByRole('button', { name: '提交开票' }));
  await screen.findByText('本次开票数量超过剩余可开数量');
  expect(saved).not.toHaveBeenCalled();
  mock.reject = false;
  fireEvent.click(screen.getByRole('button', { name: '提交开票' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const calls = mock.http.mock.calls.filter(([r]) => r.method === 'POST');
  expect(calls).toHaveLength(2);
  expect(calls[0][0].data.requestKey).toBe(calls[1][0].data.requestKey);
});
it('blocks stale over-quantity and shows server history blockers', async () => {
  show();
  await fill();
  fireEvent.change(screen.getByLabelText('电脑本次开票数量'), {
    target: { value: '4' },
  });
  expect(
    (screen.getByRole('button', { name: '提交开票' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
it('does not render a writable form for an unverified historical invoice', async () => {
  mock.blockers = ['历史发票缺少行明细'];
  show();
  await screen.findByText('历史发票缺少行明细');
  expect(screen.queryByRole('button', { name: '提交开票' })).toBeNull();
  expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy();
});
it('calculates decimal amounts in cents and rejects unsafe precision', () => {
  expect(invoiceLineCents('0.1', 0.2)).toBe(2);
  expect(invoiceLineCents('1.0001', 100)).toBe(10001);
  expect(invoiceLineCents('-1', 100)).toBeNull();
  expect(invoiceLineCents('1.00001', 100)).toBeNull();
  expect(invoiceLineCents('9999999999999', 100)).toBeNull();
});
