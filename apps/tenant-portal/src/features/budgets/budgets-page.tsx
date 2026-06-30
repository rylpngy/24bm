import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Plus, Wallet } from 'lucide-react';
import {
  type DepartmentBudgetResponse,
  useBuyerBudgetBudgets,
  useBuyerBudgetUpsert,
  useDepartmentList,
} from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Panel, PrimaryActionButton } from '@24bid/ui';

const currency = (value?: number) =>
  value == null ? '—' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}`;

const schema = z.object({
  departmentId: z.string().min(1, '请选择部门'),
  period: z.string().regex(/^\d{4}$/, '期间为 4 位年份，如 2026'),
  totalAmount: z.number().min(0, '预算不能为负'),
});
type FormValues = z.infer<typeof schema>;

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

// 占用率进度条:健康(<80 蓝)/紧张(80-100 橙)/超预算(>100 红)。
function OccupancyMeter({ percent, over }: { percent?: number; over: boolean }) {
  const p = percent ?? 0;
  const width = Math.min(p, 100);
  const tone = over ? 'bg-red-500' : p >= 80 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="mt-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${width}%` }} />
      </div>
      <p className={`mt-1 text-xs font-black ${over ? 'text-red-600' : 'text-slate-500'}`}>
        占用率 {percent == null ? '—' : `${percent}%`}
        {over && ' · 已超预算'}
      </p>
    </div>
  );
}

function BudgetCard({ b }: { b: DepartmentBudgetResponse }) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        b.overBudget ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="break-words font-black text-slate-950">{b.departmentName}</p>
          <p className="mt-0.5 text-xs font-bold text-slate-500">{b.period} 年度预算</p>
        </div>
        {b.overBudget && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-black text-red-700">
            <AlertTriangle size={12} /> 超预算
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniFact label="预算总额" value={currency(b.totalAmount)} />
        <MiniFact label="剩余" value={currency(b.remaining)} />
        <MiniFact label="已用(已通过)" value={currency(b.committed)} />
        <MiniFact label="在途(审批中)" value={currency(b.pending)} />
        <MiniFact label="实付(已付里程碑)" value={currency(b.disbursed)} />
      </div>
      <OccupancyMeter percent={b.occupancyPercent} over={b.overBudget ?? false} />
      {(b.disbursed ?? 0) > 0 && (
        <p className="mt-1 text-[11px] font-bold text-emerald-600">
          其中已实际支付 {currency(b.disbursed)}(由合同已付里程碑联动)
        </p>
      )}
    </div>
  );
}

// 预算管理:部门预算池 + 需求占用(已用/在途)→ 剩余/占用率/超预算预警。
export function BudgetsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const query = useBuyerBudgetBudgets();
  const departments = useDepartmentList().data?.data ?? [];
  const upsert = useBuyerBudgetUpsert();
  const budgets = query.data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { departmentId: '', period: '2026', totalAmount: 0 },
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/budgets'),
    });

  const onSubmit = (values: FormValues) =>
    upsert.mutate(
      { data: values },
      {
        onSuccess: () => {
          reset();
          setShowForm(false);
          refresh();
        },
      },
    );

  const overCount = budgets.filter((b) => b.overBudget).length;
  const totalBudget = budgets.reduce((s, b) => s + (b.totalAmount ?? 0), 0);
  const totalOccupied = budgets.reduce((s, b) => s + (b.committed ?? 0) + (b.pending ?? 0), 0);

  return (
    <Panel title="预算管理" icon={Wallet} subtitle="部门预算池 · 占用 · 超预算预警">
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <MiniFact label="预算总额" value={currency(totalBudget)} />
        <MiniFact label="累计占用" value={currency(totalOccupied)} />
        <MiniFact label="超预算部门" value={String(overCount)} />
      </div>

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
        >
          <Plus size={14} /> {showForm ? '收起' : '设置预算'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mb-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4"
        >
          <p className="text-sm font-black text-blue-800">设置 / 调整部门预算</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-black text-slate-500">部门</label>
              <select className={inputCls} {...register('departmentId')}>
                <option value="">请选择部门</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {errors.departmentId && (
                <p className="mt-1 text-xs font-bold text-red-600">{errors.departmentId.message}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">期间(年份)</label>
              <input className={inputCls} placeholder="2026" {...register('period')} />
              {errors.period && (
                <p className="mt-1 text-xs font-bold text-red-600">{errors.period.message}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">预算总额(元)</label>
              <input
                className={inputCls}
                type="number"
                step="1000"
                {...register('totalAmount', { valueAsNumber: true })}
              />
              {errors.totalAmount && (
                <p className="mt-1 text-xs font-bold text-red-600">{errors.totalAmount.message}</p>
              )}
            </div>
          </div>
          {upsert.isError && (
            <div className="mt-3">
              <FeedbackNotice tone="error" message="保存失败，请稍后重试。" />
            </div>
          )}
          <PrimaryActionButton
            onClick={handleSubmit(onSubmit)}
            busy={upsert.isPending}
            pendingLabel="保存中"
          >
            保存预算
          </PrimaryActionButton>
        </form>
      )}

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载部门预算…" />
      ) : budgets.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无部门预算,点击「设置预算」创建。" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((b) => (
            <BudgetCard key={b.id} b={b} />
          ))}
        </div>
      )}
    </Panel>
  );
}
