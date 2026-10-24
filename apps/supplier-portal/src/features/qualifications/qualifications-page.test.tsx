import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QualificationsPage } from './qualifications-page';
vi.mock('./supplement-requests', () => ({ SupplementRequests: () => null }));

const mocks = vi.hoisted(() => ({ status: vi.fn(), download: vi.fn().mockResolvedValue(undefined), list: vi.fn() }));
vi.mock('@24bid/api-client', () => ({
  axiosInstance: {},
  downloadReport: mocks.download,
  replaceSupplierQualification: vi.fn(),
  supplierQualificationHistory: async () => [],
  qualificationReviews: async () => [],
  useSupplierQualificationList: (params: unknown) => { mocks.list(params); return { data: { data: [{ id: 'cert', qualificationType: '营业执照', status: 'inactive', fileName: '原件.pdf' }] } }; },
  useSupplierQualificationChangeStatus: () => ({ mutate: mocks.status }),
  useSupplierQualificationCreateUploadTicket: () => ({}),
  useSupplierQualificationCreate: () => ({}),
}));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
const show = (canManage = false) => render(<QueryClientProvider client={new QueryClient()}><QualificationsPage canManage={canManage} /></QueryClientProvider>);

it('loads all statuses and sends active status from desktop and mobile', () => {
  show(true);
  expect(mocks.list).toHaveBeenCalledWith({ status: 'all' });
  for (const button of screen.getAllByRole('button', { name: '启用' })) fireEvent.click(button);
  expect(mocks.status).toHaveBeenCalledWith({ qualificationId: 'cert', data: { status: 'active' } }, expect.any(Object));
});

it('read-only users may download but cannot upload, replace or change status', () => {
  show();
  expect(screen.queryByLabelText('证照文件')).toBeNull();
  expect(screen.queryByRole('button', { name: '变更' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '下载原件' }));
  expect(mocks.download).toHaveBeenCalledWith('/api/v1/supplier/qualifications/cert/download', '原件.pdf');
});
