import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NumberingRulesPage } from './numbering-rules-page';

const state = vi.hoisted(() => ({ allowed: true, error: false, save: vi.fn(), preview: vi.fn() }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => state.allowed }) }));
vi.mock('@24bid/api-client/numbering', () => ({
  numberingRulesKey: ['numbering'],
  useNumberingRules: () => ({ isError: state.error, isPending: false, error: { message: '配置读取失败' }, data: { data: [
    { businessType: 'demand', prefix: 'REQ-', dateFormat: 'none', width: 4, enabled: true },
    { businessType: 'tender', prefix: 'ZB', dateFormat: 'yyyyMMdd', width: 3, enabled: false },
  ] } }),
  saveNumberingRule: state.save,
  previewNumberingRule: state.preview,
}));
beforeEach(() => { state.allowed = true; state.error = false; state.save.mockReset(); state.preview.mockReset(); });
afterEach(cleanup);
const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><NumberingRulesPage /></QueryClientProvider>);

it('denies configuration to ordinary business accounts', () => {
  state.allowed = false;
  show();
  expect(screen.queryByRole('button', { name: '保存需求规则' })).toBeNull();
  expect(screen.getByText(/无权管理编号规则/)).toBeTruthy();
});

it('sends edited values to real preview and save APIs', async () => {
  state.preview.mockResolvedValue({ data: { example: 'NEW-0001', consumesSequence: false, notice: '仅格式样例，不代表下一个编号' } });
  state.save.mockImplementation((_type, draft) => Promise.resolve({ data: { businessType: 'demand', ...draft } }));
  show();
  fireEvent.change(screen.getByLabelText('需求前缀'), { target: { value: 'NEW-' } });
  fireEvent.click(screen.getByRole('button', { name: '预览需求编号' }));
  await screen.findByText('NEW-0001');
  expect(state.preview).toHaveBeenCalledWith('demand', { prefix: 'NEW-', dateFormat: 'none', width: 4, enabled: true });
  fireEvent.click(screen.getByRole('button', { name: '保存需求规则' }));
  await screen.findByText('需求规则已保存');
  expect(state.save).toHaveBeenCalledWith('demand', { prefix: 'NEW-', dateFormat: 'none', width: 4, enabled: true });
});

it('retains draft and exposes server error when saving fails', async () => {
  state.save.mockRejectedValue({ response: { data: { message: '保存被拒绝' } } });
  show();
  fireEvent.change(screen.getByLabelText('需求前缀'), { target: { value: 'KEEP-' } });
  fireEvent.click(screen.getByRole('button', { name: '保存需求规则' }));
  await screen.findByText('保存被拒绝');
  expect(screen.getByLabelText('需求前缀')).toHaveValue('KEEP-');
});

it('hides stale rules on failed refresh', () => {
  state.error = true;
  show();
  expect(screen.getByText('配置读取失败')).toBeTruthy();
  expect(screen.queryByLabelText('需求前缀')).toBeNull();
});

it('does not show a preview response for a superseded draft', async () => {
  let resolve!: (value: unknown) => void;
  state.preview.mockImplementation(() => new Promise(done => { resolve = done; }));
  show();
  fireEvent.click(screen.getByRole('button', { name: '预览需求编号' }));
  fireEvent.change(screen.getByLabelText('需求前缀'), { target: { value: 'CHANGED-' } });
  resolve({ data: { example: 'STALE-0001', consumesSequence: false, notice: 'sample' } });
  await waitFor(() => expect(screen.getByRole('button', { name: '预览需求编号' })).not.toBeDisabled());
  expect(screen.queryByText('STALE-0001')).toBeNull();
});
