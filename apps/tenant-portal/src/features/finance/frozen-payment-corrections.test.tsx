import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FrozenPaymentCorrections } from './frozen-payment-corrections';
const state = vi.hoisted(() => ({
  manage: true,
  blockers: [] as string[],
  post: vi.fn(),
  api: vi.fn(),
  fail: false,
}));
vi.mock('../../lib/use-buyer-permissions', () => ({
  useBuyerPermissions: () => ({
    can: (p: string) => (p === 'buyer:payment:reverse' ? state.manage : true),
  }),
}));
vi.mock('../workflow/workflow-instance-panel', () => ({
  WorkflowStatusPanel: () => <p>真实审批历史入口</p>,
}));
vi.mock('../workflow/workflow-submit-dialog', () => ({
  WorkflowSubmitDialog: ({
    onSubmit,
    submissionError,
    busy,
  }: {
    onSubmit: (d: object) => void;
    submissionError: string;
    busy: boolean;
  }) => (
    <div role="dialog">
      <p>{submissionError}</p>
      <button disabled={busy} onClick={() => onSubmit({ checked: true })}>
        确认提交审批
      </button>
    </div>
  ),
}));
vi.mock('@24bid/api-client/http-client', () => ({
  customInstance: (args: {
    url: string;
    method: string;
    data?: unknown;
    params?: unknown;
  }) => {
    state.api(args);
    if (args.method === 'POST') {
      state.post(args);
      return state.fail
        ? Promise.reject(new Error('网络暂时中断'))
        : Promise.resolve({ data: { id: 'c1' } });
    }
    if (args.url.endsWith('/candidates'))
      return Promise.resolve({
        data: [
          {
            entryId: 'p1',
            amount: 50,
            evidenceNo: 'BANK-ORIGINAL',
            projectId: 'project',
            sourcePeriod: '2024',
            targetPeriod: '2025',
            blockers: state.blockers,
          },
        ],
      });
    return Promise.resolve({ data: { items: [], total: 21 } });
  },
}));
beforeEach(() => {
  state.manage = true;
  state.blockers = [];
  state.fail = false;
  state.api.mockClear();
  state.post.mockClear();
});
afterEach(cleanup);
function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <FrozenPaymentCorrections invoiceId="inv1" />
    </QueryClientProvider>,
  );
}
async function expand() {
  fireEvent.click(screen.getByRole('button', { name: '更正台账' }));
  await screen.findByText('BANK-ORIGINAL');
}
it('loads no correction data until the ledger is opened and shows original year and amount', async () => {
  show();
  expect(state.api).not.toHaveBeenCalled();
  await expand();
  expect(screen.getByText('2024 → 2025')).toBeTruthy();
  expect(screen.getByRole('button', { name: '申请更正' })).toBeTruthy();
});
it('shows authoritative blockers and does not offer an invalid action', async () => {
  state.blockers = ['原付款已冲销'];
  show();
  await expand();
  expect(screen.getByText('原付款已冲销')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '申请更正' })).toBeNull();
});
it('requires evidence and reason, preserves the request key on a network retry', async () => {
  state.fail = true;
  show();
  await expand();
  fireEvent.click(screen.getByRole('button', { name: '申请更正' }));
  expect(
    (screen.getByRole('button', { name: '下一步' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText('更正凭据号'), {
    target: { value: 'BANK-CORR' },
  });
  fireEvent.change(screen.getByLabelText('更正原因'), {
    target: { value: '整笔核对后更正' },
  });
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  fireEvent.click(screen.getByRole('button', { name: '确认提交审批' }));
  await waitFor(()=>expect(screen.getAllByText('网络暂时中断').length).toBeGreaterThan(0));
  fireEvent.click(screen.getByRole('button', { name: '确认提交审批' }));
  await waitFor(() => expect(state.post).toHaveBeenCalledTimes(2));
  const a = state.post.mock.calls[0][0].data,
    b = state.post.mock.calls[1][0].data;
  expect(a.requestKey).toBe(b.requestKey);
  expect(a).toMatchObject({
    entryId: 'p1',
    evidenceNo: 'BANK-CORR',
    formData: { checked: true },
  });
});
it('keeps the ledger readable without reverse permission and pages on the server', async () => {
  state.manage = false;
  show();
  await expand();
  expect(screen.queryByRole('button', { name: '申请更正' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
  await waitFor(() =>
    expect(state.api.mock.calls.some(([x]) => x.params?.page === 2)).toBe(true),
  );
});
