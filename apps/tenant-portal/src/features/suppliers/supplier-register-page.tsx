import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote, Building2, Contact, FileBadge, Handshake } from 'lucide-react';
import { usePublicPortalListSuppliers, useBuyerSupplierCreate } from '@24bid/api-client';
import { FeedbackNotice, FormErrorSummary, PrimaryActionButton } from '@24bid/ui';

const inputCls =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

function Section({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: typeof Building2;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-blue-600" />
        <h2 className="text-base font-black text-slate-950">{title}</h2>
      </div>
      <p className="mt-1 text-xs font-bold text-slate-400">{desc}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-500">
        {required && <span className="mr-1 text-red-500">*</span>}
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

// 供应商登记独立页:详细建档表单(字段对齐供应商详情页),登记后状态「待准入」。
export function SupplierRegisterPage({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient();
  const create = useBuyerSupplierCreate();
  const platformSuppliers = usePublicPortalListSuppliers();
  const [form, setForm] = useState({
    supplierId: '',
    level: '普通',
    categories: '',
    creditCode: '',
    legalPerson: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    businessScope: '',
    bankName: '',
    bankAccount: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const selectedPlatform = (platformSuppliers.data?.data ?? []).find((s) => s.id === form.supplierId);
  const ready = form.supplierId.trim() && form.level.trim();

  const submit = () => {
    const missing: string[] = [];
    if (!form.supplierId.trim()) missing.push('请选择「供应商企业」(从平台认证供应商中选择)');
    if (!form.level.trim()) missing.push('请选择「合作等级」');
    setFormErrors(missing);
    if (missing.length > 0) return;
    setError(null);
    create.mutate(
      {
        data: {
          supplierId: form.supplierId.trim(),
          status: '待准入',
          level: form.level,
          categories: form.categories.split(/[,，、\s]+/).filter(Boolean),
          creditCode: form.creditCode.trim() || undefined,
          legalPerson: form.legalPerson.trim() || undefined,
          contactName: form.contactName.trim() || undefined,
          contactPhone: form.contactPhone.trim() || undefined,
          contactEmail: form.contactEmail.trim() || undefined,
          businessScope: form.businessScope.trim() || undefined,
          bankName: form.bankName.trim() || undefined,
          bankAccount: form.bankAccount.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            predicate: (q) =>
              typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/suppliers'),
          });
          onBack();
        },
        onError: (err) =>
          setError(
            (err as { response?: { data?: { message?: string } } }).response?.data?.message
              ?? '登记失败:供应商可能已在库中。',
          ),
      },
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
            aria-label="返回供应商列表"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-950">登记私域供应商</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">
              完整建档后状态为「待准入」,在详情页提交准入审核
              <span className="ml-2 text-xs text-slate-400">(<span className="text-red-500">*</span> 为必填项,其余选填)</span>
            </p>
          </div>
        </div>
      </div>

      <Section icon={Building2} title="基本信息" desc="关联平台认证供应商;主数据(名称/行业)以平台档案为准">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="供应商企业" required>
            <select className={inputCls} value={form.supplierId} onChange={(e) => set('supplierId')(e.target.value)}>
              <option value="">从平台认证供应商中选择</option>
              {(platformSuppliers.data?.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}({s.industry || '行业未填写'})</option>
              ))}
            </select>
            {selectedPlatform && (
              <p className="mt-1.5 text-xs font-bold text-slate-400">
                平台档案:{selectedPlatform.name} · {selectedPlatform.industry || '—'} · 已通过平台认证
              </p>
            )}
          </Field>
          <Field label="合作等级" required>
            <select className={inputCls} value={form.level} onChange={(e) => set('level')(e.target.value)}>
              {['战略', '重要', '普通', '备选'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="授权品类(选填,逗号分隔)">
            <input className={inputCls} placeholder="办公设备, 办公耗材" value={form.categories} onChange={(e) => set('categories')(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section icon={FileBadge} title="工商信息" desc="选填;登记后写入供应商主档,空值不覆盖既有档案">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="统一社会信用代码">
            <input className={inputCls} placeholder="91xxxxxxxxxxxxxxxx" value={form.creditCode} onChange={(e) => set('creditCode')(e.target.value)} />
          </Field>
          <Field label="法定代表人">
            <input className={inputCls} value={form.legalPerson} onChange={(e) => set('legalPerson')(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="经营范围">
              <textarea
                className="min-h-[72px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                value={form.businessScope}
                onChange={(e) => set('businessScope')(e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section icon={Contact} title="联系人信息" desc="选填;询价邀请与履约协同的默认联系人">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="联系人姓名">
            <input className={inputCls} value={form.contactName} onChange={(e) => set('contactName')(e.target.value)} />
          </Field>
          <Field label="联系电话">
            <input className={inputCls} value={form.contactPhone} onChange={(e) => set('contactPhone')(e.target.value)} />
          </Field>
          <Field label="联系邮箱">
            <input className={inputCls} value={form.contactEmail} onChange={(e) => set('contactEmail')(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section icon={Banknote} title="结算信息" desc="选填;付款登记与对账使用">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="开户银行">
            <input className={inputCls} value={form.bankName} onChange={(e) => set('bankName')(e.target.value)} />
          </Field>
          <Field label="银行账号">
            <input className={inputCls} value={form.bankAccount} onChange={(e) => set('bankAccount')(e.target.value)} />
          </Field>
        </div>
      </Section>

      <FormErrorSummary errors={formErrors} />

      <div className="sticky bottom-4 rounded-lg border border-slate-200 bg-white/95 px-5 py-4 shadow-lg shadow-slate-300/40 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Handshake size={14} className="text-blue-600" />
            {ready ? '登记后进入「待准入」,可在详情页提交准入审核。' : '请先选择供应商企业与合作等级。'}
          </div>
          <div className="flex shrink-0 gap-3">
            {error && <FeedbackNotice tone="error" message={error} />}
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
            >
              取消
            </button>
            <PrimaryActionButton onClick={submit} busy={create.isPending} pendingLabel="登记中" size="md" flushTop>
              登记供应商
            </PrimaryActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
