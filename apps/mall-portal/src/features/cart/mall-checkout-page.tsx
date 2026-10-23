import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMallPermissions } from '../../lib/use-mall-permissions';
import { ArrowLeft, CheckCircle2, MapPin, Plus } from 'lucide-react';
import {
  useBuyerMallAddAddress,
  useBuyerMallAddresses,
  useBuyerMallCart,
  useBuyerMallCheckoutServerCart,
} from '@24bid/api-client';
import { FeedbackNotice, PrimaryActionButton, cn } from '@24bid/ui';
import type { MallRoute } from '../../App';
import { currency } from '../catalog/product-card';

const inputCls =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-300';

/** 结算页:选收货地址 → 确认拆单与金额 → 提交。清单以服务端购物车为准。 */
export function MallCheckoutPage({ onNavigate }: { onNavigate: (route: MallRoute) => void }) {
  const { can } = useMallPermissions();
  const queryClient = useQueryClient();
  const cart = useBuyerMallCart();
  const addresses = useBuyerMallAddresses();
  const addAddress = useBuyerMallAddAddress();
  const checkout = useBuyerMallCheckoutServerCart();

  const list = addresses.data?.data ?? [];
  const [addressId, setAddressId] = useState<string | null>(null);
  const [expectedReceiptDate, setExpectedReceiptDate] = useState('');
  const [remark, setRemark] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [form, setForm] = useState({ receiver: '', phone: '', province: '', city: '', district: '', detail: '' });
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ count: number; amount: number } | null>(null);

  const view = cart.data?.data;
  const groups = view?.groups ?? [];
  const selected = list.find((a) => a.id === addressId) ?? list.find((a) => a.isDefault) ?? list[0];
  const formValid = form.receiver.trim() && form.phone.trim() && form.detail.trim();

  const reportError = (e: unknown) =>
    setError(
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? '操作失败,请稍后重试',
    );

  const submit = () => {
    setError(null);
    checkout.mutate(
      {
        data: {
          addressId: selected?.id,
          expectedReceiptDate: expectedReceiptDate || undefined,
          remark: remark.trim() || undefined,
        },
      },
      {
        onSuccess: (res) => {
          const orders = res.data ?? [];
          setPlaced({
            count: orders.length,
            amount: orders.reduce((sum, o) => sum + (o.amount ?? 0), 0),
          });
          void queryClient.invalidateQueries({
            predicate: (q) => typeof q.queryKey[0] === 'string'
              && (q.queryKey[0] as string).includes('/buyer/'),
          });
        },
        onError: reportError,
      },
    );
  };

  if (cart.isError || addresses.isError) return <FeedbackNotice tone="error" message="结算信息加载失败，请刷新重试。" />;
  if (cart.isLoading || addresses.isLoading) return <FeedbackNotice tone="info" message="正在加载结算信息…" />;
  if (placed) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-10 text-center">
        <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
        <h1 className="mt-3 text-xl font-black text-slate-950">下单成功</h1>
        <p className="mt-2 text-sm font-bold text-slate-600">
          已生成 {placed.count} 张采购订单,合计 {currency(placed.amount)}。
        </p>
        <p className="mt-1 text-xs font-bold text-slate-400">
          订单已进入履约流程,供应商确认后可跟踪发货与验收。
        </p>
        <div className="mt-5 flex justify-center gap-2">
          {can('buyer:order:read') && <button
            type="button"
            onClick={() => onNavigate({ name: 'orders' })}
            className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700"
          >
            查看我的订单
          </button>}
          <button
            type="button"
            onClick={() => onNavigate({ name: 'category' })}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50"
          >
            继续采购
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => onNavigate({ name: 'cart' })}
        className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft size={14} /> 返回购物车
      </button>

      {error && <FeedbackNotice tone="error" message={error} />}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-2 text-base font-black text-slate-950">
                <MapPin size={17} className="text-blue-600" /> 收货信息
              </h2>
              {can('buyer:mall:manage') && <button
                type="button"
                onClick={() => setShowAddressForm((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-black text-blue-600 hover:underline"
              >
                <Plus size={13} /> 新增地址
              </button>}
            </div>

            {list.length === 0 && !showAddressForm && (
              <div className="mt-3">
                <FeedbackNotice
                  tone="info"
                  message="尚无企业收货地址，请联系商城管理员维护。"
                />
              </div>
            )}

            {list.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {list.map((address) => (
                  <button
                    key={address.id}
                    type="button"
                    onClick={() => setAddressId(address.id ?? null)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition',
                      selected?.id === address.id
                        ? 'border-blue-500 bg-blue-50/60'
                        : 'border-slate-200 bg-white hover:bg-slate-50',
                    )}
                  >
                    <p className="text-sm font-black text-slate-900">
                      {address.receiver}
                      <span className="ml-2 font-mono text-xs font-bold text-slate-500">
                        {address.phone}
                      </span>
                      {address.isDefault && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">
                          默认
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {address.province}
                      {address.city !== address.province ? address.city : ''}
                      {address.district}
                      {address.detail}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {can('buyer:mall:manage') && showAddressForm && (
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className={inputCls} placeholder="收货人 *" value={form.receiver}
                    onChange={(e) => setForm({ ...form, receiver: e.target.value })} />
                  <input className={inputCls} placeholder="联系电话 *" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <input className={inputCls} placeholder="省" value={form.province}
                    onChange={(e) => setForm({ ...form, province: e.target.value })} />
                  <input className={inputCls} placeholder="市" value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  <input className={inputCls} placeholder="区/县" value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })} />
                  <input className={inputCls} placeholder="详细地址 *" value={form.detail}
                    onChange={(e) => setForm({ ...form, detail: e.target.value })} />
                </div>
                <div className="mt-2 flex justify-end">
                  <PrimaryActionButton
                    size="sm"
                    busy={addAddress.isPending}
                    pendingLabel="保存中"
                    disabled={!formValid}
                    onClick={() =>
                      addAddress.mutate(
                        { data: { ...form, isDefault: list.length === 0 } },
                        {
                          onSuccess: (res) => {
                            const saved = (res.data ?? []).find((a) => a.receiver === form.receiver.trim());
                            if (saved?.id) setAddressId(saved.id);
                            setShowAddressForm(false);
                            setForm({ receiver: '', phone: '', province: '', city: '', district: '', detail: '' });
                          },
                          onError: reportError,
                        },
                      )
                    }
                  >
                    保存地址
                  </PrimaryActionButton>
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-black text-slate-500">期望到货日期(留空按承诺交期)</span>
                <input className={cn(inputCls, 'mt-1')} type="date" value={expectedReceiptDate}
                  onChange={(e) => setExpectedReceiptDate(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-black text-slate-500">订单备注</span>
                <input className={cn(inputCls, 'mt-1')} placeholder="如:工作日送达、需要开票信息"
                  value={remark} onChange={(e) => setRemark(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
            <h2 className="text-base font-black text-slate-950">
              订单预览 · 按供应商拆 {groups.length} 单
            </h2>
            <div className="mt-3 space-y-3">
              {groups.map((group) => (
                <div key={group.supplierId} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-900">{group.supplierName}</p>
                    <p className="font-mono text-sm font-black text-slate-900">
                      {currency(group.subtotal)}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {(group.lines ?? []).map((line) => (
                      <li key={line.skuId} className="flex justify-between text-xs font-bold text-slate-500">
                        <span className="truncate">
                          {line.productName} × {line.quantity}{line.unit}
                        </span>
                        <span className="font-mono">{currency(line.lineTotal)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
            <h2 className="text-base font-black text-slate-950">提交订单</h2>
            <p className="mt-3 text-xs font-bold text-slate-600">
              收货人 <b className="text-slate-900">{selected?.receiver ?? '未选择'}</b>
            </p>
            <p className="mt-3 flex items-baseline justify-between text-xs font-bold text-slate-600">
              应付合计
              <b className="font-mono text-xl text-blue-700">{currency(view?.total)}</b>
            </p>
            <div className="mt-4">
              <PrimaryActionButton
                fullWidth
                busy={checkout.isPending}
                pendingLabel="提交中"
                disabled={view?.hasBlockedItems || (view?.itemCount ?? 0) === 0}
                onClick={submit}
              >
                提交订单
              </PrimaryActionButton>
            </div>
            <p className="mt-2 text-[11px] font-bold text-slate-400">
              提交即按当前协议价与阶梯价成交,金额以服务端重算为准。
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
