import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, LogIn } from 'lucide-react';
import { LoginRequestScope, useAuthLogin } from '@24bid/api-client';
import { keycloakPasswordLogin } from '@24bid/shared';
import { FeedbackNotice, Panel, PrimaryActionButton } from '@24bid/ui';
import { useAuthStore } from '../lib/auth-store';

// 自研 JWT 已退役为 CI/开发后备;生产登录走 Keycloak(OIDC)。
const SELF_LOGIN_FALLBACK = (import.meta.env.VITE_SELF_LOGIN ?? 'true') !== 'false';

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8081';

// 供应商登录门:自研 JWT 与 Keycloak(OIDC)双路径,SUPPLIER scope。
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
      const { token, claims } = await keycloakPasswordLogin({
        keycloakUrl: KEYCLOAK_URL,
        username: 'supplier.sales@example.com',
        password: 'demo123456',
      });
      signIn({
        token,
        userId: (claims.userId as string) ?? '',
        displayName: `${(claims.displayName as string) ?? '供应商销售'}（Keycloak）`,
        supplierId: (claims.supplierId as string) ?? 'ent-supplier-sunrise',
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
          queryClient.clear();
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
          <FeedbackNotice tone="info" message="生产登录走 Keycloak（OIDC 统一身份）。演示账号：供应商销售(晨光科技)。" />
          <PrimaryActionButton onClick={handleKeycloakLogin} busy={kcBusy} pendingLabel="登录中" icon={KeyRound} fullWidth>
            用 Keycloak 登录
          </PrimaryActionButton>
          {kcError && (
            <div className="mt-3">
              <FeedbackNotice tone="error" message="Keycloak 登录失败：请确认 Keycloak 已在 8081 运行。" />
            </div>
          )}

          {SELF_LOGIN_FALLBACK && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                自研 JWT（已退役 · 仅 CI/开发后备）
              </p>
              <button type="button" onClick={handleLogin} disabled={login.isPending}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                <LogIn size={16} /> {login.isPending ? '登录中…' : '以供应商销售登录（自研 JWT）'}
              </button>
              {login.isError && (
                <div className="mt-3">
                  <FeedbackNotice tone="error" message="登录失败：自研登录可能已在后端关闭（SELF_LOGIN_ENABLED=false）。" />
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
