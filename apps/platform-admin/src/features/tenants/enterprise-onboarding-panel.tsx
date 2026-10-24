import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, KeyRound, Plus, Store } from 'lucide-react';
import { usePlatformSupplierCreate, usePlatformTenantCreate } from '@24bid/api-client';
import { FeedbackNotice, Panel } from '@24bid/ui';

type Kind = 'buyer' | 'supplier';

const DEFAULT_FEATURES = ['rfq', 'order', 'finance', 'contract', 'mall'];

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

// 企业开通:平台侧创建采购租户 / 供应商企业 + 初始管理员;
// 成功后展示 Keycloak 建号清单(OIDC 身份在 Keycloak,claim 必须与库内 ID 对齐)。
export function EnterpriseOnboardingPanel({ embedded = false, canCreateSupplier = false }:
  { embedded?: boolean; canCreateSupplier?: boolean } = {}) {
  const queryClient = useQueryClient();
  const createTenant = usePlatformTenantCreate();
  const createSupplier = usePlatformSupplierCreate();
  const [kind, setKind] = useState<Kind>('buyer');
  const [open, setOpen] = useState(embedded);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [claimGuide, setClaimGuide] = useState<{ userId: string; scopeKey: string; scopeValue: string } | null>(null);
  const [form, setForm] = useState({
    id: '',
    name: '',
    industry: '',
    adminName: '',
    adminEmail: '',
    adminMobile: '',
    adminPassword: '',
  });

  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));
  const busy = createTenant.isPending || createSupplier.isPending;
  const ready =
    form.id.trim() && form.name.trim() && form.industry.trim() && form.adminName.trim()
    && form.adminEmail.trim() && form.adminPassword.length >= 8;

  const onSubmit = () => {
    if (kind === 'supplier' && !canCreateSupplier) return;
    setFeedback(null);
    setClaimGuide(null);
    if (kind === 'buyer') {
      const tenantId = form.id.trim();
      createTenant.mutate(
        {
          data: {
            tenantId,
            enterpriseId: `ent-${tenantId}-buyer`,
            name: form.name.trim(),
            industry: form.industry.trim(),
            plan: 'MVP',
            userLimit: 50,
            enabledFeatures: DEFAULT_FEATURES,
            adminName: form.adminName.trim(),
            adminMobile: form.adminMobile.trim(),
            adminEmail: form.adminEmail.trim(),
            adminPassword: form.adminPassword,
          },
        },
        {
          onSuccess: () => {
            setFeedback({ tone: 'success', text: `租户 ${tenantId} 已开通。` });
            setClaimGuide({ userId: `user-${tenantId}-owner`, scopeKey: 'tenantId', scopeValue: tenantId });
            void queryClient.invalidateQueries();
          },
          onError: () => setFeedback({ tone: 'error', text: '开通失败:租户 ID 可能已存在。' }),
        },
      );
    } else {
      const enterpriseId = form.id.trim();
      createSupplier.mutate(
        {
          data: {
            enterpriseId,
            name: form.name.trim(),
            industry: form.industry.trim(),
            adminName: form.adminName.trim(),
            adminMobile: form.adminMobile.trim(),
            adminEmail: form.adminEmail.trim(),
            adminPassword: form.adminPassword,
          },
        },
        {
          onSuccess: (res) => {
            setFeedback({ tone: 'success', text: `供应商企业 ${res.data?.name ?? enterpriseId} 已开通。` });
            setClaimGuide({
              userId: res.data?.adminUserId ?? `user-${enterpriseId}-owner`,
              scopeKey: 'supplierId',
              scopeValue: enterpriseId,
            });
            void queryClient.invalidateQueries();
          },
          onError: () => setFeedback({ tone: 'error', text: '开通失败:企业 ID 可能已存在。' }),
        },
      );
    }
  };

  const body = (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
        >
          <Plus size={14} /> 开通新企业
        </button>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-1 sm:w-80">
            {(
              [
                { id: 'buyer', label: '采购租户', icon: Building2 },
                { id: 'supplier', label: '供应商企业', icon: Store },
              ] as const
            ).filter(t => t.id === 'buyer' || canCreateSupplier).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setKind(t.id)}
                className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-black transition ${
                  kind === t.id ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500'
                }`}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label={kind === 'buyer' ? '租户 ID(如 tenant-foo)' : '企业 ID(如 ent-foo-supplier)'}
              value={form.id}
              onChange={set('id')}
              placeholder={kind === 'buyer' ? 'tenant-*' : 'ent-*'}
            />
            <Field label="企业名称" value={form.name} onChange={set('name')} />
            <Field label="所属行业" value={form.industry} onChange={set('industry')} />
            <Field label="管理员姓名" value={form.adminName} onChange={set('adminName')} />
            <Field label="管理员邮箱" value={form.adminEmail} onChange={set('adminEmail')} />
            <Field label="管理员手机(选填)" value={form.adminMobile} onChange={set('adminMobile')} />
            <Field label="初始密码(≥8 位)" value={form.adminPassword} onChange={set('adminPassword')} type="password" />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy || !ready}
              onClick={onSubmit}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800 disabled:bg-slate-400"
            >
              {busy ? '开通中…' : '确认开通'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setFeedback(null); setClaimGuide(null); }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              收起
            </button>
          </div>

          {feedback && <FeedbackNotice tone={feedback.tone} message={feedback.text} />}
          {claimGuide && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
              <p className="flex items-center gap-1.5 text-xs font-black text-amber-800">
                <KeyRound size={14} /> 下一步:在 Keycloak 为管理员建号(登录依赖 OIDC)
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs font-bold text-amber-800">
                <li>
                  Keycloak 管理台 → 24bid realm → Users → Create user:用户名用管理员邮箱 {form.adminEmail || ''},
                  <b>务必填写姓/名并勾选 Email verified</b>(否则登录报 Account is not fully set up)
                </li>
                <li>Credentials 页设置密码(去掉 Temporary);Details 页确认 Required user actions 为空</li>
                <li>
                  Attributes 页添加:<code className="rounded bg-white px-1">userId={claimGuide.userId}</code>、
                  <code className="rounded bg-white px-1">{claimGuide.scopeKey}={claimGuide.scopeValue}</code>、
                  <code className="rounded bg-white px-1">authScope={claimGuide.scopeKey === 'tenantId' ? 'BUYER' : 'SUPPLIER'}</code>、
                  <code className="rounded bg-white px-1">displayName=管理员姓名</code>
                </li>
                <li>
                  Role mapping 页分配 realm 角色
                  <code className="rounded bg-white px-1">{claimGuide.scopeKey === 'tenantId' ? 'BUYER_OWNER' : 'SUPPLIER_SALES'}</code>
                  (接口按角色放行,缺失会一律 403)
                </li>
                <li>完成后管理员即可在对应门户登录(24bid-portal client 已带 claim 映射)</li>
              </ol>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-4">{body}</div>;
  }
  return (
    <Panel title="企业开通" icon={Plus} subtitle="创建采购租户 / 供应商企业与初始管理员">
      {body}
    </Panel>
  );
}
