import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TenantsPage } from './tenants-page';

const api = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn(), mutate: vi.fn(), failed: false }));
vi.mock('@24bid/api-client', () => ({
  axiosInstance: api,
  usePlatformTenantList: () => ({ data: { data: [{ id: 't', name: '企业甲', plan: '标准版', status: 'active', userLimit: 10, enabledFeatures: ['rfq', 'order', 'finance', 'contract', 'mall'] }] }, isError: api.failed }),
  usePlatformTenantEnable: () => ({ mutate: api.mutate }),
  usePlatformTenantDisable: () => ({ mutate: api.mutate }),
  usePlatformTenantUpdateFeatures: () => ({ mutate: api.mutate }),
  usePlatformTenantUpdatePlan: () => ({ mutate: api.mutate }),
}));
vi.mock('./enterprise-onboarding-panel', () => ({ EnterpriseOnboardingPanel: () => <div>Onboarding</div> }));
vi.mock('./tenant-usage-panel', () => ({ TenantUsagePanel: () => <div>Usage</div> }));
const catalog = { plans: [{ code: 'MVP', label: 'MVP' }, { code: 'Growth', label: '标准版' }, { code: 'Enterprise', label: '企业版' }],
  features: [{ key: 'rfq', label: '寻源立项' }, { key: 'order', label: '订单履约' }, { key: 'finance', label: '财务管理' }, { key: 'contract', label: '合同兼容标识', configurable: false }, { key: 'mall', label: '商城兼容标识', configurable: false }],
  methods: [{ featureKey: 'method:mall', label: '商城直采' }] };
beforeEach(() => { vi.clearAllMocks(); api.failed = false; api.get.mockResolvedValue({ data: { data: catalog } }); api.put.mockResolvedValue({ data: { data: {} } }); });
afterEach(cleanup);
const show = (canManage = false, canReadUsage = false) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><TenantsPage {...{ canManage, canReadUsage }} /></QueryClientProvider>);

it('read-only users cannot onboard edit change status or access unauthorized usage', () => {
  show();
  for (const name of ['编辑', '停用', '开通新企业', '用量']) expect(screen.queryByRole('button', { name })).toBeNull();
  expect(screen.getByText('企业甲')).toBeTruthy();
});
it('usage access is independent of tenant management', () => {
  show(false, true);
  expect(screen.getByRole('button', { name: '用量' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '编辑' })).toBeNull();
});
it('saves configuration in one request and keeps the draft on failure', async () => {
  api.put.mockRejectedValue({ response: { data: { message: '配置冲突，请重试' } } });
  show(true);
  fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  await screen.findByRole('option', { name: '标准版' });
  expect(screen.getByLabelText('套餐')).toHaveValue('Growth');
  fireEvent.click(screen.getByLabelText('全部关闭'));
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/platform/tenants/t/configuration', expect.objectContaining({ plan: 'Growth', enabledFeatures: expect.arrayContaining(['method:none', 'contract', 'mall']) })));
  expect(await screen.findByRole('alert')).toHaveTextContent('配置冲突');
  expect(screen.getByLabelText('全部关闭')).toBeChecked();
  expect(api.mutate).not.toHaveBeenCalled();
});
it('does not show cached tenant records when loading fails', () => {
  api.failed = true; show();
  expect(screen.getByRole('alert')).toHaveTextContent('租户加载失败');
  expect(screen.queryByText('企业甲')).toBeNull();
});
it('unchecking the last explicit method closes all methods rather than reopening inherited ones', async () => {
  show(true); fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  await screen.findByRole('option', { name: '标准版' });
  fireEvent.click(screen.getByLabelText('指定方式'));
  fireEvent.click(screen.getByLabelText('商城直采'));
  expect(screen.getByLabelText('全部关闭')).toBeChecked();
});
it('preserves legacy markers without presenting them as newly enforced module switches', async () => {
  show(true); fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  await screen.findByRole('option', { name: '标准版' });
  expect(screen.getByLabelText('合同兼容标识')).toBeChecked();
  expect(screen.getByLabelText('合同兼容标识')).toBeDisabled();
  expect(screen.getByLabelText('商城兼容标识')).toBeDisabled();
});
