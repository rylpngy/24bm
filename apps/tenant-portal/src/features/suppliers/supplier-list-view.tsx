import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Boxes, ChevronRight, Plus, Search } from 'lucide-react';
import { useBuyerSupplierCreate, useBuyerSupplierList } from '@24bid/api-client';
import {
  FeedbackNotice,
  MiniFact,
  Pagination,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
  StatusPill,
  cn,
} from '@24bid/ui';

const PAGE_SIZE = 8;

const STATUS_FILTERS = ['全部', '待准入', '准入审批中', '已准入', '已驳回', '黑名单'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const schema = z.object({
  supplierId: z.string().min(2, '请填写供应商企业 ID'),
  level: z.string().min(1, '请填写合作等级'),
  categories: z.string().min(1, '请填写授权品类'),
});
type FormValues = z.infer<typeof schema>;

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

// 供应商列表子页:KPI + 状态筛选 + 登记 + 钻取 360(onOpen)。
export function SupplierListView({ onOpen }: { onOpen: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>('全部');
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [level, setLevel] = useState('全部');
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);

  const query = useBuyerSupplierList();
  const create = useBuyerSupplierCreate();
  const all = query.data?.data ?? [];

  const levels = ['全部', ...Array.from(new Set(all.map((s) => s.level).filter(Boolean) as string[]))];
  const kw = keyword.trim().toLowerCase();
  const suppliers = all.filter((s) => {
    if (status !== '全部' && s.status !== status) return false;
    if (level !== '全部' && s.level !== level) return false;
    if (!kw) return true;
    const haystack = [s.supplierName, s.creditCode, ...(s.categories ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(kw);
  });
  const pageCount = Math.max(1, Math.ceil(suppliers.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = suppliers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectStatus = (s: StatusFilter) => {
    setStatus(s);
    setPage(1);
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { supplierId: '', level: '普通', categories: '' },
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/suppliers'),
    });

  const onSubmit = (values: FormValues) =>
    create.mutate(
      {
        data: {
          supplierId: values.supplierId,
          status: '待准入',
          level: values.level,
          categories: values.categories.split(/[,，、\s]+/).filter(Boolean),
        },
      },
      {
        onSuccess: () => {
          reset();
          setShowForm(false);
          refresh();
        },
      },
    );

  const count = (s: StatusFilter) => (s === '全部' ? all.length : all.filter((x) => x.status === s).length);
  const scored = all.filter((s) => s.performanceScore != null);
  const avgScore =
    scored.length > 0
      ? Math.round((scored.reduce((sum, s) => sum + (s.performanceScore ?? 0), 0) / scored.length) * 10) / 10
      : null;

  return (
    <Panel title="供应商列表" icon={Boxes} subtitle="私域关系 · 准入 · 分级 · 绩效">
      <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <MiniFact label="供应商总数" value={String(all.length)} />
        <MiniFact label="待准入" value={String(count('待准入'))} />
        <MiniFact label="准入审批中" value={String(count('准入审批中'))} />
        <MiniFact label="已准入" value={String(count('已准入'))} />
        <MiniFact label="平均绩效" value={avgScore == null ? '—' : String(avgScore)} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setKeyword(input.trim());
          setPage(1);
        }}
        className="mb-3 flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="按名称 / 信用代码 / 品类搜索"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        >
          {levels.map((lv) => (
            <option key={lv} value={lv}>
              {lv === '全部' ? '全部等级' : `等级 ${lv}`}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700"
        >
          <Search size={14} /> 搜索
        </button>
        {(keyword || input || level !== '全部') && (
          <button
            type="button"
            onClick={() => {
              setInput('');
              setKeyword('');
              setLevel('全部');
              setPage(1);
            }}
            className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
          >
            清除
          </button>
        )}
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => selectStatus(s)}
              className={cn(
                'h-8 rounded-md border px-3 text-xs font-black transition',
                s === status
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {s}
              {count(s) > 0 && <span className="ml-1 text-slate-400">{count(s)}</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
        >
          <Plus size={14} /> {showForm ? '收起' : '新增供应商'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mb-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4"
        >
          <p className="text-sm font-black text-blue-800">登记私域供应商</p>
          <p className="mt-0.5 text-xs font-bold text-blue-600">登记后状态为「待准入」,在详情页提交准入。</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-black text-slate-500">供应商企业 ID</label>
              <input className={inputCls} placeholder="如 ent-supplier-sunrise" {...register('supplierId')} />
              {errors.supplierId && (
                <p className="mt-1 text-xs font-bold text-red-600">{errors.supplierId.message}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">合作等级</label>
              <input className={inputCls} placeholder="战略 / 重要 / 普通" {...register('level')} />
              {errors.level && (
                <p className="mt-1 text-xs font-bold text-red-600">{errors.level.message}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">授权品类(逗号分隔)</label>
              <input className={inputCls} placeholder="办公设备, 办公耗材" {...register('categories')} />
              {errors.categories && (
                <p className="mt-1 text-xs font-bold text-red-600">{errors.categories.message}</p>
              )}
            </div>
          </div>
          {create.isError && (
            <div className="mt-3">
              <FeedbackNotice tone="error" message="登记失败:供应商可能已在库中。" />
            </div>
          )}
          <PrimaryActionButton onClick={handleSubmit(onSubmit)} busy={create.isPending} pendingLabel="登记中">
            登记供应商
          </PrimaryActionButton>
        </form>
      )}

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载供应商库…" />
      ) : suppliers.length === 0 ? (
        <FeedbackNotice tone="info" message="当前筛选下暂无供应商。" />
      ) : (
        <ResponsiveTableFrame
          mobileCards={pageItems.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => s.id && onOpen(s.id)}
              className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-200/50 transition hover:border-blue-200 hover:bg-blue-50/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">
                    <span className="mr-1.5 font-mono text-slate-400">
                      {(safePage - 1) * PAGE_SIZE + i + 1}.
                    </span>
                    {s.supplierName}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    等级 {s.level} · 最近评分 {s.lastEvaluationScore ?? '—'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {s.status && <StatusPill label={s.status} />}
                  {s.cooperationTier && <StatusPill label={s.cooperationTier} />}
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniFact label="授权品类" value={(s.categories ?? []).join('、') || '—'} />
                <MiniFact label="绩效评分" value={String(s.performanceScore ?? '—')} />
              </div>
              <p className="mt-3 inline-flex items-center gap-1 text-xs font-black text-blue-600">
                查看供应商 360 <ChevronRight size={13} />
              </p>
            </button>
          ))}
        >
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 w-14">序号</th>
                <th className="px-4 py-3">供应商</th>
                <th className="px-4 py-3">准入状态</th>
                <th className="px-4 py-3">等级</th>
                <th className="px-4 py-3">生命周期标记</th>
                <th className="px-4 py-3">授权品类</th>
                <th className="px-4 py-3 text-right">绩效</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pageItems.map((s, i) => (
                <tr
                  key={s.id}
                  onClick={() => s.id && onOpen(s.id)}
                  className="cursor-pointer transition hover:bg-blue-50/40"
                >
                  <td className="px-4 py-4 font-mono font-black text-slate-400">
                    {(safePage - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td className="px-4 py-4 font-bold text-slate-900">{s.supplierName}</td>
                  <td className="px-4 py-4">{s.status && <StatusPill label={s.status} />}</td>
                  <td className="px-4 py-4 font-black text-slate-700">{s.level}</td>
                  <td className="px-4 py-4">{s.cooperationTier && <StatusPill label={s.cooperationTier} />}</td>
                  <td className="px-4 py-4 text-slate-600">{(s.categories ?? []).join('、')}</td>
                  <td className="px-4 py-4 text-right font-mono font-black text-slate-900">
                    {s.performanceScore}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-black text-blue-600">
                      查看 <ChevronRight size={13} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTableFrame>
      )}

      {!query.isLoading && suppliers.length > 0 && (
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={suppliers.length} onPageChange={setPage} />
      )}
    </Panel>
  );
}
