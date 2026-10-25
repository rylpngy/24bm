import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';
import { FeedbackNotice } from '@24bid/ui';
import {
  useBuyerMallListings,
  useBuyerMallAddresses,
  projectMallCheckout,
  projectMallSelection,
  type ProjectPackage,
} from '@24bid/api-client';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import {
  ProjectDialog,
  projectButton as btn,
  projectInput as input,
  projectMoney as money,
} from './project-dialog';

export function ProjectMallPanel({
  projectId,
  lot,
  enabled,
  onChanged,
}: {
  projectId: string;
  lot: ProjectPackage;
  enabled: boolean;
  onChanged: () => Promise<void>;
}) {
  const { can } = useBuyerPermissions();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [form, setForm] = useState({
    revision: 0,
    requestKey: '',
    reason: '',
    date: '',
    address: '',
    rows: [] as Array<{ materialId: string; skuId: string; quantity: number }>,
  });
  const catalog = useBuyerMallListings(
    { status: '在架' },
    { query: { enabled: open && can('buyer:mall:read') } },
  );
  const addresses = useBuyerMallAddresses({
    query: { enabled: open && can('buyer:mall:read') },
  });
  const historical = Object.values(lot.sourceMethods || {}).includes('商城');
  const selection = useQuery({
    queryKey: ['project-mall-selection', projectId, lot.info.id],
    queryFn: () => projectMallSelection(projectId, lot.info.id),
    enabled: historical && can('buyer:mall:read'),
  });
  const items = catalog.isError ? [] : catalog.data?.data || [];
  const suppliers = new Set(
    form.rows
      .map((r) => items.find((i) => i.id === r.skuId)?.supplierId)
      .filter(Boolean),
  );
  const complete = lot.lines.every(
    (l) =>
      Math.abs(
        form.rows
          .filter((r) => r.materialId === l.materialId)
          .reduce((s, r) => s + r.quantity, 0) - l.quantity,
      ) < 0.000001,
  );
  const allowed =
    enabled &&
    [
      'buyer:mall:read',
      'buyer:mall:purchase',
      'buyer:rfq:manage',
      'buyer:rfq:read',
      'buyer:order:manage',
      'buyer:demand:read',
    ].every(can) &&
    lot.info.status === 'ready' &&
    !lot.runs.length &&
    !!lot.demands.length &&
    lot.demands.every((d) => d.status === '已通过');
  function patch(i: number, value: Partial<(typeof form.rows)[number]>) {
    setForm((f) => ({
      ...f,
      rows: f.rows.map((r, n) => (n === i ? { ...r, ...value } : r)),
    }));
  }
  let saved: Array<{
    name: string;
    brand: string;
    skuCode: string;
    spec: string;
    supplierName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
  }> = [];
  try {
    const value = JSON.parse(selection.data?.snapshot || '{}').selections;
    saved = Array.isArray(value) ? value : [];
  } catch {
    /* The explicit load error below blocks malformed history. */
  }
  const invalidHistory = !!selection.data && !saved.length;
  return (
    <section
      className="min-w-0 space-y-3 border-t border-slate-200 pt-4"
      aria-label="分包商城采购"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold">商城选型与成交记录</h3>
        {allowed && (
          <button
            className={btn}
            type="button"
            onClick={() => {
              setForm({
                revision: lot.info.revision,
                requestKey: crypto.randomUUID(),
                reason: '',
                date: '',
                address: '',
                rows: lot.lines.map((l) => ({
                  materialId: l.materialId,
                  skuId: '',
                  quantity: l.quantity,
                })),
              });
              setError('');
              setOpen(true);
            }}
          >
            <ShoppingCart size={14} />
            商城选型下单
          </button>
        )}
      </div>
      {(selection.isError || invalidHistory) && (
        <FeedbackNotice
          tone="error"
          message="商城成交记录加载失败，请刷新重试。"
        />
      )}
      {can('buyer:mall:read') &&
        !selection.isError &&
        selection.data &&
        !invalidHistory && (
          <>
            <div className="flex flex-wrap gap-3 text-sm">
              <a
                className={btn}
                href={`?module=orders&recordId=${encodeURIComponent(selection.data.orderId)}`}
              >
                采购订单
              </a>
              <span className="self-center text-slate-500">
                {selection.data.reason}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {[
                      '物料/品牌',
                      '型号/参数',
                      '供应商',
                      '数量',
                      '成交单价',
                      '成交金额',
                    ].map((h) => (
                      <th key={h} className="p-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {saved.map((s, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="p-3">
                        {s.name}
                        <p className="text-xs text-slate-500">
                          {s.brand || '—'}
                        </p>
                      </td>
                      <td className="max-w-56 truncate p-3" title={s.spec}>
                        {s.skuCode} · {s.spec}
                      </td>
                      <td className="p-3">{s.supplierName}</td>
                      <td className="whitespace-nowrap p-3">
                        {s.quantity} {s.unit}
                      </td>
                      <td className="p-3">{money(s.unitPrice)}</td>
                      <td className="p-3">{money(s.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      {open && (
        <ProjectDialog
          title="分包商城选型"
          busy={busy}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || !complete || suppliers.size !== 1) return;
              setBusy(true);
              setError('');
              try {
                await projectMallCheckout(projectId, lot.info.id, {
                  revision: form.revision,
                  requestKey: form.requestKey,
                  reason: form.reason,
                  items: form.rows.map((r) => ({
                    skuId: r.skuId,
                    quantity: r.quantity,
                  })),
                  expectedReceiptDate: form.date || undefined,
                  addressId: form.address || undefined,
                });
                await onChanged();
                setOpen(false);
              } catch (e) {
                setError(
                  (e as { response?: { data?: { message?: string } } }).response
                    ?.data?.message ||
                    (e instanceof Error ? e.message : '下单失败，请重试。'),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="flex flex-wrap gap-5 text-sm">
              <span>分包批准金额 {money(lot.info.amount)}</span>
              <span>
                需求批准预算{' '}
                {money(lot.demands.reduce((s, d) => s + d.budget, 0))}
              </span>
            </div>
            {error && <FeedbackNotice tone="error" message={error} />}
            {catalog.isError && (
              <FeedbackNotice
                tone="error"
                message="商城目录加载失败，请关闭后重试。"
              />
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] table-fixed text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="w-36 p-2">批准物料</th>
                    <th className="p-2">商城规格 / 供应商 / 目录单价</th>
                    <th className="w-28 p-2">选购数量</th>
                    <th className="w-14 p-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {form.rows.map((r, i) => {
                    const line = lot.lines.find(
                      (l) => l.materialId === r.materialId,
                    )!;
                    return (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="p-2">
                          {line.name}
                          <p className="mt-1 text-xs text-slate-500">
                            批准 {line.quantity} {line.unit}
                          </p>
                        </td>
                        <td className="p-2">
                          <select
                            className={input}
                            required
                            aria-label={`商城规格${i + 1}`}
                            value={r.skuId}
                            onChange={(e) =>
                              patch(i, { skuId: e.target.value })
                            }
                          >
                            <option value="">
                              {catalog.isLoading
                                ? '正在加载…'
                                : '请选择关联规格'}
                            </option>
                            {items
                              .filter(
                                (s) =>
                                  s.materialId === r.materialId &&
                                  s.unit === line.unit,
                              )
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.materialName} · {s.materialCode} ·{' '}
                                  {s.supplierName} · {money(s.price || 0)}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            className={input}
                            aria-label={`选购数量${i + 1}`}
                            type="number"
                            min="0.0001"
                            step="0.0001"
                            required
                            value={r.quantity}
                            onChange={(e) =>
                              patch(i, { quantity: Number(e.target.value) })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <button
                            type="button"
                            className={btn}
                            aria-label={`移除选型${i + 1}`}
                            title="移除选型"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                rows: f.rows.filter((_, n) => n !== i),
                              }))
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              {lot.lines.map((l) => (
                <button
                  type="button"
                  className={btn}
                  key={l.materialId}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      rows: [
                        ...f.rows,
                        { materialId: l.materialId, skuId: '', quantity: 0 },
                      ],
                    }))
                  }
                >
                  <Plus size={14} />
                  {l.name}
                </button>
              ))}
            </div>
            {!complete && (
              <FeedbackNotice
                tone="error"
                message="选购数量合计须与每项批准数量一致。"
              />
            )}
            {suppliers.size > 1 && (
              <FeedbackNotice
                tone="error"
                message="同一包须选择同一供应商；多供应商采购请拆分分包。"
              />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span>期望到货日期</span>
                <input
                  type="date"
                  className={input}
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>收货地址</span>
                <select
                  className={input}
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                >
                  <option value="">默认地址 / 线下约定</option>
                  {(addresses.data?.data || []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.receiver} · {a.detail}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-2 text-sm">
              <span>
                选型与下单依据 <span className="text-red-600">*</span>
              </span>
              <textarea
                className={input}
                required
                maxLength={1000}
                value={form.reason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reason: e.target.value }))
                }
              />
            </label>
            <footer className="flex justify-end gap-2">
              <button
                className={btn}
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                取消
              </button>
              <button
                className={btn + ' !border-blue-600 !bg-blue-600 !text-white'}
                type="submit"
                disabled={
                  busy ||
                  !complete ||
                  suppliers.size !== 1 ||
                  catalog.isError ||
                  !form.rows.length ||
                  form.rows.some((r) => !r.skuId || r.quantity <= 0) ||
                  !form.reason.trim()
                }
              >
                <ShoppingCart size={14} />
                {busy ? '正在下单…' : '确认选型并下单'}
              </button>
            </footer>
          </form>
        </ProjectDialog>
      )}
    </section>
  );
}
