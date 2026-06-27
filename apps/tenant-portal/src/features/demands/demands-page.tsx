import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus } from 'lucide-react';
import {
  type PurchaseDemandResponse,
  usePurchaseDemandList,
  usePurchaseDemandSubmit,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  MiniFact,
  Pagination,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
  SearchInput,
  StatusPill,
  cn,
} from '@24bid/ui';
import { DemandCreateForm } from './demand-create-form';
import { DemandDetail } from './demand-detail';

const currency = (value?: number) =>
  value == null ? '—' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const STATUS_FILTERS = ['全部', '草稿', '审批中', '已通过', '已驳回'] as const;

export function DemandsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<PurchaseDemandResponse | null>(null);

  const query = usePurchaseDemandList(status === '全部' ? undefined : { status });
  const submit = usePurchaseDemandSubmit();
  const demands = query.data?.data ?? [];
  const kw = keyword.toLowerCase();
  const filtered = demands.filter(
    (d) =>
      !kw || [d.title, d.id, d.departmentId].filter(Boolean).join(' ').toLowerCase().includes(kw),
  );
  const PAGE_SIZE = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (selected) {
    const fresh = demands.find((d) => d.id === selected.id) ?? selected;
    return <DemandDetail demand={fresh} onBack={() => setSelected(null)} />;
  }

  const refreshDemands = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/demands'),
    });

  const handleSubmitForApproval = (demandId: string) => {
    submit.mutate({ demandId }, { onSuccess: () => refreshDemands() });
  };

  return (
    <Panel title="采购需求" icon={ClipboardList} subtitle="需求列表 · 审批提交 · 转询价">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={cn(
                'h-8 rounded-md border px-3 text-xs font-black transition',
                s === status
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按标题 / 编号 / 部门搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700"
        >
          <Plus size={14} /> {showForm ? '收起' : '新建需求'}
        </button>
      </div>

      {showForm && (
        <DemandCreateForm
          onCreated={() => {
            setShowForm(false);
            refreshDemands();
          }}
        />
      )}

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载需求列表…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice tone="info" message="当前筛选下暂无采购需求。" />
      ) : (
        <>
        <ResponsiveTableFrame
          mobileCards={pageItems.map((d) => (
            <div
              key={d.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">{d.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{d.id}</p>
                </div>
                {d.status && <StatusPill label={d.status} />}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniFact label="申请部门" value={d.departmentId ?? '—'} />
                <MiniFact label="预算金额" value={currency(d.budget)} />
              </div>
              <button
                type="button"
                onClick={() => setSelected(d)}
                className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                查看详情
              </button>
              {d.status === '草稿' && d.id && (
                <PrimaryActionButton
                  onClick={() => handleSubmitForApproval(d.id!)}
                  busy={submit.isPending && submit.variables?.demandId === d.id}
                  pendingLabel="提交中"
                  fullWidth
                >
                  提交审批
                </PrimaryActionButton>
              )}
            </div>
          ))}
        >
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 w-14">序号</th>
                <th className="px-4 py-3">需求编号</th>
                <th className="px-4 py-3">标题</th>
                <th className="px-4 py-3">申请部门</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3 text-right">预算金额</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pageItems.map((d, i) => (
                <tr key={d.id}>
                  <td className="px-4 py-4 font-mono font-black text-slate-400">
                    {(safePage - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td className="px-4 py-4 font-mono font-black text-slate-700">{d.id}</td>
                  <td className="px-4 py-4 font-bold text-slate-900">{d.title}</td>
                  <td className="px-4 py-4 text-slate-600">{d.departmentId}</td>
                  <td className="px-4 py-4">{d.status && <StatusPill label={d.status} />}</td>
                  <td className="px-4 py-4 text-right font-mono font-black text-slate-900">
                    {currency(d.budget)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {d.status === '草稿' && d.id && (
                        <button
                          type="button"
                          onClick={() => handleSubmitForApproval(d.id!)}
                          disabled={submit.isPending && submit.variables?.demandId === d.id}
                          className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-400"
                        >
                          {submit.isPending && submit.variables?.demandId === d.id ? '提交中' : '提交审批'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelected(d)}
                        className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                      >
                        详情
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTableFrame>
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
