import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DemandCreateForm } from './demand-create-form';

const api = vi.hoisted(() => ({ update: vi.fn(), create: vi.fn() }));
vi.mock('@24bid/api-client', () => ({
  useDepartmentList: () => ({ data: { data: [{ id: 'dept-it', name: '信息部' }] } }),
  useMaterialList: () => ({ data: { data: [{ id: 'mat-1', name: '电脑' }] } }),
  usePurchaseDemandCreate: () => ({ mutate: api.create }),
  usePurchaseDemandUpdate: () => ({ mutate: api.update }),
}));

it('edits a rejected demand in place instead of creating a replacement application', async () => {
  const props = { onBack: vi.fn(), onCreated: vi.fn(), initialDemand: {
    id: 'demand-1', title: '驳回需求', status: '已驳回', departmentId: 'dept-it', budget: 100,
    lineItems: [{ materialId: 'mat-1', quantity: 2 }],
  } };
  render(<DemandCreateForm {...props} />);
  expect(screen.getByDisplayValue('驳回需求')).toBeTruthy();
  fireEvent.change(screen.getByDisplayValue('驳回需求'), { target: { value: '修正需求' } });
  fireEvent.click(screen.getByRole('button', { name: '保存需求修改' }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith(expect.objectContaining({
    demandId: 'demand-1', data: expect.objectContaining({ title: '修正需求', budget: 100 }),
  }), expect.anything()));
  expect(api.create).not.toHaveBeenCalled();
});
