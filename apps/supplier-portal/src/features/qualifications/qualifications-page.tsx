import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react';
import { useSupplierQualificationChangeStatus, useSupplierQualificationList } from '@24bid/api-client';
import {
  FilterTabs,
  FeedbackNotice,
  Pagination,
  Panel,
  ResponsiveTableFrame,
  SearchInput,
  StatusPill,
  cn,
} from '@24bid/ui';

const PAGE_SIZE = 8;

const isExpired = (d?: string) => !!d && d < new Date().toISOString().slice(0, 10);

// 资质认证:证照档案列表(类型/编号/有效期/文件)+ 状态管理;证照上传由采购方核验通道归档。
export function QualificationsPage() {
  const queryClient = useQueryClient();
  const quals = useSupplierQualificationList();
  const changeStatus = useSupplierQualificationChangeStatus();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);

  const all = quals.data?.data ?? [];
  const statuses = ['全部', ...Array.from(new Set(all.map((q) => q.status).filter(Boolean) as string[]))];
  const kw = keyword.toLowerCase();
  const list = all.filter((q) => {
    if (statusFilter !== '全部' && q.status !== statusFilter) return false;
    if (!kw) return true;
    return [q.qualificationType, q.certificateNo, q.fileName].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const statusCount = (s: string) => (s === '全部' ? all.length : all.filter((q) => q.status === s).length);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const expiringCount = all.filter((q) => isExpired(q.expiresAt)).length;

  const toggle = (id: string, current?: string) => {
    const next = current === '停用' ? '有效' : '停用';
    changeStatus.mutate(
      { qualificationId: id, data: { status: next } },
      {
        onSuccess: () => {
          setFeedback(next === '停用' ? '资质已停用。' : '资质已恢复有效。');
          setError(null);
          queryClient.invalidateQueries({
            predicate: (q) =>
              typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/supplier/qualifications'),
          });
        },
        onError: (e) =>
          setError(
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              '状态更新失败,请稍后重试。',
          ),
      },
    );
  };

  return (
    <Panel title="资质认证" icon={BadgeCheck} subtitle="证照档案 · 有效期跟踪 · 状态管理">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={statuses.map((s) => ({ id: s, label: s, count: s === '全部' ? undefined : statusCount(s) }))}
          value={statusFilter}
          onChange={(id) => {
            setStatusFilter(id);
            setPage(1);
          }}
        />
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按资质类型 / 证书编号搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
      </div>

      {expiringCount > 0 && (
        <div className="mb-4">
          <FeedbackNotice tone="error" message={`${expiringCount} 项资质已过有效期,请尽快联系采购方更新证照,避免影响准入与投标。`} />
        </div>
      )}
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}
      {error && (
        <div className="mb-4">
          <FeedbackNotice tone="error" message={error} />
        </div>
      )}

      {quals.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载资质档案…" />
      ) : quals.isError ? (
        <FeedbackNotice tone="error" message="资质档案加载失败:登录态可能已过期,请重新登录后重试。" />
      ) : list.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={
            keyword || statusFilter !== '全部'
              ? '没有符合条件的资质。'
              : '暂无资质档案。资质证照经采购方准入核验通道归档后展示在此;在线自助上传通道规划中。'
          }
        />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((q, i) => (
              <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 font-mono text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                      {q.qualificationType}
                    </p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-500">{q.certificateNo || '—'}</p>
                  </div>
                  {q.status && <StatusPill label={q.status} />}
                </div>
                <p className={cn('mt-2 font-mono text-xs font-black', isExpired(q.expiresAt) ? 'text-red-600' : 'text-slate-600')}>
                  有效期至 {q.expiresAt ?? '长期'}
                  {isExpired(q.expiresAt) && ' · 已过期'}
                </p>
              </div>
            ))}
          >
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">资质类型</th>
                  <th className="px-5 py-4">证书编号</th>
                  <th className="px-5 py-4">证照文件</th>
                  <th className="px-5 py-4">有效期至</th>
                  <th className="px-5 py-4">归档时间</th>
                  <th className="px-5 py-4">状态</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((q, i) => (
                  <tr key={q.id} className="hover:bg-blue-50/30">
                    <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                      {(safePage - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-5 py-5 font-black text-slate-950">{q.qualificationType}</td>
                    <td className="px-5 py-5 font-mono text-xs font-black text-slate-500">{q.certificateNo || '—'}</td>
                    <td className="px-5 py-5 text-xs font-bold text-slate-600">{q.fileName || '—'}</td>
                    <td className={cn('px-5 py-5 font-mono text-xs font-black', isExpired(q.expiresAt) ? 'text-red-600' : 'text-slate-600')}>
                      {q.expiresAt ?? '长期'}
                      {isExpired(q.expiresAt) && (
                        <span className="ml-1.5 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-600">已过期</span>
                      )}
                    </td>
                    <td className="px-5 py-5 font-mono text-xs font-bold text-slate-500">{q.createdAt?.slice(0, 10) ?? '—'}</td>
                    <td className="px-5 py-5">{q.status && <StatusPill label={q.status} />}</td>
                    <td className="px-5 py-5 text-right">
                      <button
                        type="button"
                        disabled={changeStatus.isPending}
                        onClick={() => q.id && toggle(q.id, q.status ?? undefined)}
                        className={cn(
                          'inline-flex h-8 items-center rounded-md border px-3 text-xs font-black transition disabled:opacity-50',
                          q.status === '停用'
                            ? 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        {q.status === '停用' ? '恢复有效' : '停用'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTableFrame>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={list.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
