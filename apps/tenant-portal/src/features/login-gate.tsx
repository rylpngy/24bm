import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, LogIn } from 'lucide-react';
import { LoginRequestScope, useAuthLogin } from '@24bid/api-client';
import { FeedbackNotice, Panel, PrimaryActionButton } from '@24bid/ui';
import { useAuthStore } from '../lib/auth-store';

const KEYCLOAK_TOKEN_URL =
  (import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8081') +
  '/realms/24bid/protocol/openid-connect/token';

// 解码 JWT payload(仅取展示用 claim,不验签)。
function decodeJwt(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch {
    return {};
  }
}

// S1：采购方登录门。自研 JWT(/auth/login)与 Keycloak(OIDC direct-grant)双路径。
export function LoginGate() {
  const signIn = useAuthStore((s) => s.signIn);
  const queryClient = useQueryClient();
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
          username: 'buyer.owner@example.com',
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
        displayName: `${(claims.displayName as string) ?? '采购负责人'}（Keycloak）`,
        tenantId: (claims.tenantId as string) ?? 'tenant-acme',
      });
      queryClient.clear();
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
          account: 'buyer.owner@example.com',
          password: 'demo123456',
          scope: LoginRequestScope.BUYER,
          tenantId: 'tenant-acme',
        },
      },
      {
        onSuccess: (res) => {
          const data = res.data;
          if (!data?.accessToken || !data.tenantId) return;
          signIn({
            token: data.accessToken,
            userId: data.userId ?? '',
            displayName: data.displayName ?? '采购负责人',
            tenantId: data.tenantId,
          });
          queryClient.clear();
        },
      },
    );
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100/70 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-950/30">
            24
          </div>
          <div>
            <p className="text-lg font-black text-slate-900">24Bid 企业工作台</p>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Tenant Portal
            </p>
          </div>
        </div>
        <Panel title="登录" icon={LogIn} subtitle="采购方企业端 · tenant-acme">
          <FeedbackNotice tone="info" message="演示账号：采购负责人。点击登录进入采购主流程。" />
          <PrimaryActionButton
            onClick={handleLogin}
            busy={login.isPending}
            pendingLabel="登录中"
            icon={LogIn}
            fullWidth
          >
            以采购负责人登录
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
            <button
              type="button"
              onClick={handleKeycloakLogin}
              disabled={kcBusy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
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
