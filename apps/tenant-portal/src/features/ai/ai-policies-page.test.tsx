import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AiPoliciesPage } from './ai-policies-page';

const api = vi.hoisted(() => ({ allowed: true, list: vi.fn(), save: vi.fn(), transition: vi.fn() }));
vi.mock('@24bid/api-client/ai-reviews', () => ({ listAiPolicies: api.list, createAiPolicy: api.save, transitionAiPolicy: api.transition }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => api.allowed }) }));
const policy = { id: 'p1', policyKey: 'procurement', title: '采购制度', version: 1, subjectTypes: ['demand'], status: 'draft', clauses: [{ id: 'clause_1', title: '审查程序', text: '超过阈值须履行审查程序' }], sourceHash: 'sha-policy', createdAt: '2026-01-01T00:00:00Z', createdBy: 'owner' };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AiPoliciesPage /></QueryClientProvider>);
beforeEach(() => { api.allowed = true; api.list.mockReset().mockResolvedValue([policy]); api.save.mockReset().mockResolvedValue({ ...policy, version: 2 }); api.transition.mockReset().mockResolvedValue({ ...policy, status: 'published' }); });
afterEach(cleanup);

it('shows immutable policy history separately from a new version draft', async () => {
  mount(); expect(await screen.findByRole('button', { name: '查看 采购制度 版本 1' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '查看 采购制度 版本 1' }));
  expect(screen.getByText('超过阈值须履行审查程序')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '删除' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '新增制度版本' }));
  fireEvent.change(screen.getByLabelText('制度编号'), { target: { value: 'procurement' } });
  fireEvent.change(screen.getByLabelText('制度名称'), { target: { value: '采购制度' } });
  fireEvent.change(screen.getByLabelText('条款标题 1'), { target: { value: '审查程序' } });
  fireEvent.change(screen.getByLabelText('条款正文 1'), { target: { value: '第二版正文' } });
  fireEvent.click(screen.getByRole('button', { name: '保存新版本' }));
  await waitFor(() => expect(api.save).toHaveBeenCalledWith({ policyKey: 'procurement', title: '采购制度', subjectTypes: ['demand'], clauses: [{ id: 'clause_1', title: '审查程序', text: '第二版正文' }], expectedLatestVersion: 1 }));
});

it('does not query or expose policy configuration without manage permission', () => {
  api.allowed = false; mount();
  expect(screen.getByText('当前账号无制度依据管理权限。')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '新增制度版本' })).toBeNull();
  expect(api.list).not.toHaveBeenCalled();
});

it('keeps a rejected version draft rather than falsely reporting it saved', async () => {
  api.save.mockRejectedValue({ response: { data: { message: '制度内容过长' } } });
  mount(); await screen.findByRole('button', { name: '查看 采购制度 版本 1' });
  fireEvent.click(screen.getByRole('button', { name: '新增制度版本' }));
  fireEvent.change(screen.getByLabelText('制度编号'), { target: { value: 'procurement' } });
  fireEvent.change(screen.getByLabelText('制度名称'), { target: { value: '采购制度' } });
  fireEvent.change(screen.getByLabelText('条款标题 1'), { target: { value: '正式文件' } });
  fireEvent.change(screen.getByLabelText('条款正文 1'), { target: { value: '保留原稿' } });
  fireEvent.click(screen.getByRole('button', { name: '保存新版本' }));
  expect(await screen.findByText('制度内容过长')).toBeTruthy();
  expect((screen.getByLabelText('条款正文 1') as HTMLTextAreaElement).value).toBe('保留原稿');
});

it('publishes a draft only on explicit action', async () => {
  mount(); fireEvent.click(await screen.findByRole('button', { name: '查看 采购制度 版本 1' }));
  expect(api.transition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '发布' }));
  await waitFor(() => expect(api.transition).toHaveBeenCalledWith('p1', 'publish'));
  expect(await screen.findByText('制度版本已发布。')).toBeTruthy();
});

it('locks every draft input while a save is in progress', async () => {
  api.save.mockImplementation(() => new Promise(() => {}));
  mount(); fireEvent.click(await screen.findByRole('button', { name: '查看 采购制度 版本 1' }));
  fireEvent.click(screen.getByRole('button', { name: '基于此版本新建' }));
  fireEvent.click(screen.getByRole('button', { name: '保存新版本' }));
  await waitFor(() => expect(screen.getByLabelText('条款正文 1')).toBeDisabled());
  expect(screen.getByLabelText('制度名称')).toBeDisabled();
  expect(screen.getByLabelText('制度编号')).toBeDisabled();
  expect(screen.getByLabelText('供应商')).toBeDisabled();
});

it('uses browser Unicode-sets compatible patterns for policy and clause identifiers', async () => {
  mount(); fireEvent.click(await screen.findByRole('button', { name: '查看 采购制度 版本 1' }));
  fireEvent.click(screen.getByRole('button', { name: '基于此版本新建' }));
  for (const label of ['制度编号', '条款编号 1']) {
    const pattern = screen.getByLabelText(label).getAttribute('pattern')!;
    expect(() => new RegExp(pattern, 'v')).not.toThrow();
    const regex = new RegExp(`^(?:${pattern})$`, 'v');
    expect(regex.test('policy-main_1')).toBe(true);
    expect(regex.test('含空格 invalid')).toBe(false);
  }
});
