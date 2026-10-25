import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProjectMallPanel } from './project-mall-panel';
import type { ProjectPackage } from '@24bid/api-client';
const f = vi.hoisted(() => ({
  write: vi.fn(),
  history: vi.fn(),
  allowed: true,
  error: false,
}));
vi.mock('../../lib/use-buyer-permissions', () => ({
  useBuyerPermissions: () => ({ can: () => f.allowed }),
}));
vi.mock('@24bid/api-client', () => ({
  useBuyerMallListings: () => ({
    data: {
      data: [
        {
          id: 'sku',
          materialId: 'm',
          unit: '台',
          supplierId: 's',
          supplierName: '供应商甲',
          materialName: '计算机',
          materialCode: 'ModelA',
          price: 100,
        },
        {
          id: 'foreign',
          materialId: 'other',
          unit: '台',
          supplierId: 's',
          materialName: '其他物料',
        },
        {
          id: 'unit',
          materialId: 'm',
          unit: '箱',
          supplierId: 's',
          materialName: '不符单位',
        },
      ],
    },
    isError: f.error,
  }),
  useBuyerMallAddresses: () => ({ data: { data: [] } }),
  projectMallSelection: (...args: unknown[]) => f.history(...args),
  projectMallCheckout: (...args: unknown[]) => f.write(...args),
}));
const base = {
  info: {
    id: 'lot',
    title: '电脑包',
    revision: 2,
    status: 'ready',
    amount: 300,
  },
  lines: [{ materialId: 'm', name: '计算机', unit: '台', quantity: 2 }],
  demands: [{ id: 'd', budget: 250, status: '已通过' }],
  runs: [],
  sourceStatuses: {},
  sourceMethods: {},
} as unknown as ProjectPackage;
function mount(lot = base) {
  const changed = vi.fn().mockResolvedValue(undefined);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ProjectMallPanel projectId="p" lot={lot} enabled onChanged={changed} />
    </QueryClientProvider>,
  );
  return changed;
}
beforeEach(() => {
  f.allowed = true;
  f.error = false;
  f.write.mockReset().mockResolvedValue({});
  f.history.mockReset().mockResolvedValue(null);
});
afterEach(cleanup);
it('filters SKU choices by approved material and unit and submits source quantity, version and stable request key', async () => {
  const changed = mount();
  fireEvent.click(screen.getByRole('button', { name: '商城选型下单' }));
  expect(
    screen.queryByRole('option', { name: /其他物料|不符单位/ }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('商城规格1'), {
    target: { value: 'sku' },
  });
  fireEvent.change(
    screen
      .getByText('选型与下单依据')
      .closest('label')!
      .querySelector('textarea')!,
    { target: { value: '调研后确认规格' } },
  );
  fireEvent.click(screen.getByRole('button', { name: '确认选型并下单' }));
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  expect(f.write).toHaveBeenCalledWith(
    'p',
    'lot',
    expect.objectContaining({
      revision: 2,
      reason: '调研后确认规格',
      requestKey: expect.any(String),
      items: [{ skuId: 'sku', quantity: 2 }],
    }),
  );
});
it('blocks partial quantity and tells the user why', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: '商城选型下单' }));
  fireEvent.change(screen.getByLabelText('选购数量1'), {
    target: { value: '1' },
  });
  expect(screen.getByText('选购数量合计须与每项批准数量一致。')).toBeVisible();
  expect(screen.getByRole('button', { name: '确认选型并下单' })).toBeDisabled();
  expect(f.write).not.toHaveBeenCalled();
});
it('keeps request key and source version after a server error and does not claim success', async () => {
  f.write.mockRejectedValue(new Error('库存不足'));
  mount();
  fireEvent.click(screen.getByRole('button', { name: '商城选型下单' }));
  fireEvent.change(screen.getByLabelText('商城规格1'), {
    target: { value: 'sku' },
  });
  fireEvent.change(
    screen
      .getByText('选型与下单依据')
      .closest('label')!
      .querySelector('textarea')!,
    { target: { value: '依据' } },
  );
  fireEvent.click(screen.getByRole('button', { name: '确认选型并下单' }));
  await screen.findByText('库存不足');
  const first = f.write.mock.calls[0][2];
  fireEvent.click(screen.getByRole('button', { name: '确认选型并下单' }));
  await waitFor(() => expect(f.write).toHaveBeenCalledTimes(2));
  expect(f.write.mock.calls[1][2]).toEqual(first);
});
it('renders historical commercial snapshots and actual order navigation, never a second checkout', async () => {
  f.history.mockResolvedValue({
    orderId: 'o1',
    reason: '已成交依据',
    snapshot: JSON.stringify({
      selections: [
        {
          name: '计算机',
          brand: '原品牌',
          skuCode: '原型号',
          spec: '16G',
          supplierName: '供应商甲',
          quantity: 2,
          unit: '台',
          unitPrice: 100,
          amount: 200,
        },
      ],
    }),
  });
  mount({
    ...base,
    runs: [
      {
        id: 'run',
        projectId: 'p',
        packageId: 'lot',
        executionType: 'rfq',
        executionId: 'rfq',
        status: 'active',
        reason: '',
        createdBy: 'u',
        createdAt: new Date().toISOString(),
      },
    ],
    sourceMethods: { rfq: '商城' },
  } as ProjectPackage);
  expect(await screen.findByText('原品牌')).toBeVisible();
  expect(screen.getByRole('link', { name: '采购订单' })).toHaveAttribute(
    'href',
    '?module=orders&recordId=o1',
  );
  expect(
    screen.queryByRole('button', { name: '商城选型下单' }),
  ).not.toBeInTheDocument();
});
it('does not offer checkout without source permissions or show stale catalogue after error', () => {
  f.allowed = false;
  mount();
  expect(
    screen.queryByRole('button', { name: '商城选型下单' }),
  ).not.toBeInTheDocument();
});
