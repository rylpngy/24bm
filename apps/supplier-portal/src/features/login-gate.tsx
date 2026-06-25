import { useState } from 'react';
import { KeyRound, LogIn } from 'lucide-react';
import { LoginRequestScope, useAuthLogin } from '@24bid/api-client';
import { FeedbackNotice, Panel, PrimaryActionButton } from '@24bid/ui';
import { useAuthStore } from '../lib/auth-store';

const KEYCLOAK_TOKEN_URL =
  (import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8081') +
  '/realms/24bid/protocol/openid-connect/token';

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch {
    return {};
  }
}

// 供应商登录门:自研 JWT 与 Keycloak(OIDC)双路径,SUPPLIER scope。
export function LoginGate() {
  const signIn = useAuthStore((s) => s.signIn);
  const login = useAuthLogin();
  const [kcBusy, setKcBusy] = useState(false);
  const [kcError, setKcError] = useState(false);

  const handleKeycloakLogin = async () => {
    setKcBusy(true);
    setKcError(false);
    try {
      const res = await fetch(KEYCLOAK_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: '24bid-portal',
          username: 'supplier.sales@example.com',
          password: 'demo123456',
        }),
      });
      if (!res.ok) throw new Error('keycloak login failed');
      const data = await res.json();
      const token = data.access_token as string;
      const claims = decodeJwt(token);
      signIn({
        token,
        userId: (claims.userId as string) ?? '',
        displayName: `${(claims.displayName as string) ?? '供应商销售'}（Keycloak）`,
        supplierId: (claims.supplierId as string) ?? 'ent-supplier-sunrise',
      });
    } catch {
      setKcError(true);
    } finally {
      setKcBusy(false);
    }
  };

  const handleLogin = () => {
    login.mutate(
      {
        data: {
          account: 'supplier.sales@example.com',
          password: 'demo123456',
          scope: LoginRequestScope.SUPPLIER,
          supplierId: 'ent-supplier-sunrise',
        },
      },
      {
        onSuccess: (res) => {
          const data = res.data;
          if (!data?.accessToken || !data.supplierId) return;
          signIn({
            token: data.accessToken,
            userId: data.userId ?? '',
            displayName: data.displayName ?? '供应商销售',
            supplierId: data.supplierId,
          });
        },
      },
    );
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100/70 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600 text-lg font-black text-white shadow-lg">
            24
          </div>
          <div>
            <p className="text-lg font-black text-slate-900">24Bid 供应商门户</p>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Supplier Portal</p>
          </div>
        </div>
        <Panel title="登录" icon={LogIn} subtitle="供应商端 · 商机 / 报价 / 订单 / 应收">
          <FeedbackNotice tone="info" message="演示账号：供应商销售(晨光科技)。点击登录进入供应商协作。" />
          <PrimaryActionButton onClick={handleLogin} busy={login.isPending} pendingLabel="登录中" icon={LogIn} fullWidth>
            以供应商销售登录
          </PrimaryActionButton>
          {login.isError && (
            <div className="mt-3">
              <FeedbackNotice tone="error" message="登录失败：请确认后端已在 8080 运行。" />
            </div>
          )}

          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
              或使用 Keycloak（OIDC）
            </p>
            <button type="button" onClick={handleKeycloakLogin} disabled={kcBusy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              <KeyRound size={16} /> {kcBusy ? '登录中…' : '用 Keycloak 登录'}
            </button>
            {kcError && (
              <div className="mt-3">
                <FeedbackNotice tone="error" message="Keycloak 登录失败：请确认 Keycloak 已在 8081 运行。" />
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
