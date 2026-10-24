import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { SupplierEvaluationTemplatesView } from './supplier-evaluation-templates-view';
const mocks = vi.hoisted(() => ({ manage: true, create: vi.fn(), version: vi.fn(), enabled: vi.fn(), refetch: vi.fn() }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: (p: string) => !p.endsWith(':manage') || mocks.manage }) }));
vi.mock('@24bid/api-client/supplier-evaluation-templates', async original => ({
  ...await original<object>(),
  useEvaluationTemplates: () => ({ data: { data: [
    { id: 'v1', templateId: 'group', name: '质量优先', version: 1, qualityWeight: 100, deliveryWeight: 0, priceWeight: 0, serviceWeight: 0, enabled: true },
    { id: 'v2', templateId: 'group', name: '新版质量', version: 2, qualityWeight: 80, deliveryWeight: 20, priceWeight: 0, serviceWeight: 0, enabled: true },
  ] }, refetch: mocks.refetch }),
  createEvaluationTemplate: mocks.create, createEvaluationTemplateVersion: mocks.version, setEvaluationTemplateEnabled: mocks.enabled,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.manage = true; });
function mount() { render(<QueryClientProvider client={new QueryClient()}><SupplierEvaluationTemplatesView /></QueryClientProvider>); }
it('validates weights, permits zero, and preserves a failed draft', async () => {
  mocks.create.mockRejectedValue(new Error('offline')); mount();
  fireEvent.click(screen.getByRole('button', { name: '新建模板' }));
  fireEvent.change(screen.getByLabelText('模板名称'), { target: { value: '只看质量' } });
  fireEvent.change(screen.getByLabelText('质量权重'), { target: { value: '100' } });
  expect(screen.getByRole('button', { name: '保存模板' })).toBeDisabled();
  for (const name of ['交付权重', '价格权重', '服务权重']) fireEvent.change(screen.getByLabelText(name), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: '保存模板' }));
  await screen.findByText('保存失败，填写内容已保留，请重试。');
  expect(screen.getByLabelText('模板名称')).toHaveValue('只看质量');
  expect(mocks.create).toHaveBeenCalledWith({ name: '只看质量', qualityWeight: 100, deliveryWeight: 0, priceWeight: 0, serviceWeight: 0 });
});
it('lists all immutable versions and creates a new version using the group id', async () => {
  mocks.version.mockResolvedValue({}); mount();
  expect(screen.getByText('质量优先')).toBeInTheDocument(); expect(screen.getByRole('heading', { name: '新版质量' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '新建版本' }));
  expect(screen.getByLabelText('模板名称')).toHaveValue('新版质量');
  fireEvent.click(screen.getByRole('button', { name: '保存模板' }));
  await waitFor(() => expect(mocks.version).toHaveBeenCalledWith('group', expect.objectContaining({ name: '新版质量', qualityWeight: 80 })));
});
it('toggles the group rather than a version and hides mutations for read-only users', async () => {
  mocks.enabled.mockResolvedValue({}); mount();
  fireEvent.click(screen.getByRole('switch', { name: '启用 新版质量' }));
  await waitFor(() => expect(mocks.enabled).toHaveBeenCalledWith('group', false));
  cleanup(); mocks.manage = false; mount();
  expect(screen.queryByRole('button', { name: '新建模板' })).not.toBeInTheDocument();
  expect(screen.getByRole('switch', { name: '启用 新版质量' })).toBeDisabled();
});
