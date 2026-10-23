import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupplierRegisterPage } from './supplier-register-page';

const mocks = vi.hoisted(() => ({ write: true, create: vi.fn(), update: vi.fn() }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => mocks.write }) }));
vi.mock('@24bid/api-client', () => ({
  usePublicPortalListSuppliers: () => ({ data: { data: [{ id: 'supplier-1', name: '测试供应商' }] } }),
  useBuyerSupplierCreate: () => ({ mutate: mocks.create, isPending: false }),
  useBuyerSupplierChangeProfile: () => ({ mutate: mocks.update, isPending: false }),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.write = true; });

function edit() {
  return render(<QueryClientProvider client={new QueryClient()}><SupplierRegisterPage onBack={() => {}}
    supplier={{ id: 'relation-1', supplierId: 'supplier-1', supplierName: '测试供应商', level: 'A',
      categories: ['设备'], bankAccount: 'OLD-ACCOUNT', contactName: '张三' }} />
  </QueryClientProvider>);
}

it('loads private data and saves explicit empty values instead of restoring shared data', () => {
  edit();
  expect((screen.getByLabelText('合作等级', { exact: false }) as HTMLSelectElement).value).toBe('A');
  expect((screen.getByLabelText('供应商企业', { exact: false }) as HTMLSelectElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('银行账号'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('联系人姓名'), { target: { value: '李四' } });
  fireEvent.click(screen.getByRole('button', { name: '保存资料' }));
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ relationId: 'relation-1',
    data: expect.objectContaining({ bankAccount: '', contactName: '李四', level: 'A', categories: ['设备'] }) }), expect.anything());
  expect(mocks.create).not.toHaveBeenCalled();
});

it('blocks saving after write permission is removed', () => {
  mocks.write = false;
  edit();
  const button = screen.getByRole('button', { name: '保存资料' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(mocks.update).not.toHaveBeenCalled();
});

it('keeps an API error visible in the editor', () => {
  mocks.update.mockImplementationOnce((_input, options) => options.onError({ response: { data: { message: '资料保存失败' } } }));
  edit();
  fireEvent.click(screen.getByRole('button', { name: '保存资料' }));
  expect(screen.getByText('资料保存失败')).toBeTruthy();
});
