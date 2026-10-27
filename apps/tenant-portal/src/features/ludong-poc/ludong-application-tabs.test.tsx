import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LudongPocForm } from './ludong-poc-form';
import { ApplicationTabs, applicationFormTabs, requiredFieldTab } from './ludong-application-tabs';
import { LudongPocApplicationSnapshot } from './ludong-poc-application-snapshot';
import { defaultFormData, emptyItem, type LudongApplication } from './api';

vi.mock('@24bid/api-client', () => ({
  axiosInstance: {}, downloadReport: vi.fn(),
  useDepartmentList: () => ({ data: { data: [{ id: 'root', name: '学校' }, { id: 'dept', name: '教务处', parentId: 'root' }] } }),
}));
vi.mock('./ludong-poc-material-items-editor', () => ({
  inferGovernmentMallCatalog: () => ({ value: '否', reason: '测试目录' }),
  LudongPocMaterialItemsEditor: ({ stage }: { stage: string }) => <p>{stage === 'application' ? '设备编辑器' : '商城编辑器'}</p>,
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const initial: LudongApplication = {
  id: 'demo', applicationNo: 'DEMO', projectName: '实验设备', applicantUnit: '教务处', departmentId: 'dept',
  budgetAmount: 100, status: 'draft', createdBy: 'demo', createdAt: '', updatedAt: '',
  formData: { ...defaultFormData, fundingSource: '年度教学经费', fundingUnitId: 'dept', projectLeaderName: '张老师',
    technicalLeaderName: '李老师', procurementFunction: '采集', procurementGoal: '教学', purchaseReason: '更新',
    implementationLocation: '实验楼', installationReady: '是', utilitiesReady: '是', deliveryDays: '30', warrantyYears: '3',
    siteVisitRequired: '否', sampleRequired: '否', demoRequired: '否' },
  items: [{ ...emptyItem(), name: '采集仪', unit: '台', quantity: '1', unitPrice: '100', technicalParameters: '八通道',
    purpose: '教学', usageDirection: '教学', imported: '否', userName: '张老师', installationLocation: '实验楼',
    coreProduct: '是', governmentMallCatalog: '否' }],
};

it('keeps edits across steps and saves the complete payload only on explicit save', () => {
  const save = vi.fn();
  render(<LudongPocForm initial={initial} busy={false} onBack={vi.fn()} onSave={save} />);
  fireEvent.change(screen.getByLabelText(/采购项目名称/), { target: { value: '更新后的项目' } });
  fireEvent.click(screen.getByRole('tab', { name: '采购要求' }));
  expect(screen.queryByLabelText(/采购项目名称/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/购置理由及必要性/), { target: { value: '修改后的必要性' } });
  fireEvent.click(screen.getByRole('tab', { name: '基本信息' }));
  expect(screen.getByLabelText(/采购项目名称/)).toHaveValue('更新后的项目');
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '保存申报' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ projectName: '更新后的项目', budgetAmount: 100,
    formData: expect.objectContaining({ purchaseReason: '修改后的必要性' }), items: expect.arrayContaining([expect.objectContaining({ name: '采集仪' })]) }));
});

it('routes save validation to a missing field on another tab without losing data', () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const save = vi.fn();
  render(<LudongPocForm initial={{ ...initial, formData: { ...initial.formData, purchaseReason: '' } }} busy={false} onBack={vi.fn()} onSave={save} />);
  fireEvent.click(screen.getByRole('button', { name: '检查并保存' }));
  expect(screen.getByRole('tab', { name: /采购要求/ })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('本页待完成：购置理由及必要性')).toBeVisible();
  expect(save).not.toHaveBeenCalled();
});

it('saves incomplete drafts without final validation and restores the saved tab on re-entry', async () => {
  const draft = vi.fn().mockResolvedValue(initial);
  const save = vi.fn();
  const view = render(<LudongPocForm busy={false} onBack={vi.fn()} onSave={save} onSaveDraft={draft} />);
  fireEvent.change(screen.getByLabelText(/采购项目名称/), { target: { value: '未完成的申报' } });
  fireEvent.click(screen.getByRole('tab', { name: /采购要求/ }));
  fireEvent.change(screen.getByLabelText(/购置理由及必要性/), { target: { value: '分步填写的理由' } });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await waitFor(() => expect(screen.getByText(/草稿已保存/)).toBeVisible());
  const payload = draft.mock.calls[0][0];
  expect(payload).toMatchObject({ projectName: '未完成的申报', applicantUnit: '', items: [],
    formData: { _draftTab: 'requirements', purchaseReason: '分步填写的理由' } });
  expect(save).not.toHaveBeenCalled();
  view.unmount();
  render(<LudongPocForm initial={{ ...initial, ...payload }} busy={false} onBack={vi.fn()} onSave={save} onSaveDraft={draft} />);
  expect(screen.getByRole('tab', { name: /采购要求/ })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByLabelText(/购置理由及必要性/)).toHaveValue('分步填写的理由');
});

it('does not announce a successful draft save when the server fails', async () => {
  const draft = vi.fn().mockRejectedValue(new Error('保存失败'));
  render(<LudongPocForm busy={false} onBack={vi.fn()} onSave={vi.fn()} onSaveDraft={draft} />);
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await waitFor(() => expect(draft).toHaveBeenCalledOnce());
  expect(screen.queryByText(/草稿已保存/)).not.toBeInTheDocument();
});

it('groups mall and equipment validation separately and supports keyboard tab navigation', () => {
  expect(requiredFieldTab('第 1 条商城最终型号')).toBe('mall');
  expect(requiredFieldTab('第 1 条配置标准单价')).toBe('mall');
  expect(requiredFieldTab('第 1 条是否属于网上商城目录')).toBe('equipment');
  expect(requiredFieldTab('质量保证期')).toBe('delivery');
  const change = vi.fn();
  render(<ApplicationTabs tabs={applicationFormTabs} value="basic" onChange={change}>内容</ApplicationTabs>);
  fireEvent.keyDown(screen.getByRole('tab', { name: '基本信息' }), { key: 'ArrowRight' });
  expect(change).toHaveBeenCalledWith('equipment');
  expect(screen.getByRole('tab', { name: '设备清单' })).toHaveFocus();
});

it('separates detail categories while preserving full snapshots for approval callers', () => {
  const app = { ...initial, formData: { ...initial.formData, argumentationOpinion: '同意' } };
  const { rerender } = render(<LudongPocApplicationSnapshot app={app} view="basic" />);
  expect(screen.getByText('项目与经费')).toBeVisible();
  expect(screen.queryByText('拟采购设备清单')).not.toBeInTheDocument();
  rerender(<LudongPocApplicationSnapshot app={app} view="equipment" />);
  expect(screen.getByText('拟采购设备清单')).toBeVisible();
  expect(screen.queryByText('项目与经费')).not.toBeInTheDocument();
  rerender(<LudongPocApplicationSnapshot app={app} view="approvals" />);
  expect(screen.getByText('购置必要性论证')).toBeVisible();
  rerender(<LudongPocApplicationSnapshot app={app} />);
  expect(screen.getByText('拟采购设备清单')).toBeVisible();
  expect(screen.getByText('项目与经费')).toBeVisible();
  expect(screen.getByText('网上商城品牌型号确认单')).toBeVisible();
});
