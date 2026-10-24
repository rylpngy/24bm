import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { TenderProjectsPage } from './tender-projects-page';

const state = vi.hoisted(() => ({ failed: false, awarded: false }));
vi.mock('@24bid/api-client', async (original) => ({
  ...await original<Record<string, unknown>>(),
  useSupplierTenderList: () => ({ isError: state.failed, data: { data: [{
    id: 't-1', title: '测试招标', tenderNo: 'Z001', status: state.awarded ? '已定标' : '发售中',
    acquisitionDeadline: '2020-01-01T00:00:00Z', tenderType: '邀请招标',
    acquisitions: [{ supplierId: 's-1', source: '邀请发放', acquiredAt: state.awarded ? '2020-01-01' : null }],
    awardedBidId: state.awarded ? 'b-1' : null, openedAt: state.awarded ? '2020-01-02' : null,
    awardNoticeHtml: state.awarded ? '<p>中标通知正文</p>' : null,
    bids: state.awarded ? [{ id: 'b-1', supplierId: 's-1', supplierName: '供应商', bidAmount: 10, sealedStatus: '已开启' }] : [],
  }] } }),
  useSupplierTenderAcquire: () => ({}),
  useSupplierTenderApplyPrequalification: () => ({}),
  useSupplierTenderSubmitBid: () => ({}),
  useSupplierTenderWithdrawBid: () => ({}),
  useSupplierEsignSign: () => ({}),
  useSupplierEsignList: () => ({ data: { data: [] } }),
  usePublicProcurementAnnouncementList: () => ({ data: { data: [] } }),
}));
afterEach(() => { cleanup(); state.failed = false; state.awarded = false; });
const show = () => render(<QueryClientProvider client={new QueryClient()}><TenderProjectsPage /></QueryClientProvider>);
const detail = () => fireEvent.click(screen.getAllByRole('button', { name: '查看招标' })[0]);

it('hides stale tenders when the request fails', () => {
  state.failed = true;
  show();
  expect(screen.queryAllByText('测试招标')).toHaveLength(0);
  expect(screen.getByText(/加载失败/)).toBeTruthy();
});

it('does not offer invited acquisition after its deadline', () => {
  show(); detail();
  expect(screen.queryByRole('button', { name: '确认领取招标文件' })).toBeNull();
  expect(screen.getByText(/文件获取已截止/)).toBeTruthy();
});

it('does not claim the award notice is signed or label the original quote as the award amount', () => {
  state.awarded = true;
  show(); detail();
  expect(screen.getByText('中标通知正文')).toBeTruthy();
  expect(screen.queryByText(/招标人已电子签章/)).toBeNull();
  expect(screen.getByText('原始投标报价')).toBeTruthy();
});
