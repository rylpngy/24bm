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

// 平台运营登录门:自研 JWT 与 Keycloak(OIDC)双路径,PLATFORM scope。
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
      const { token, claims, refreshToken } = await keycloakPasswordLogin({
        keycloakUrl: KEYCLOAK_URL,
        username: 'platform.admin@example.com',
        password: 'demo123456',
      });
      signIn({
        token,
        refreshToken,
        userId: (claims.userId as string) ?? '',
        displayName: `${(claims.displayName as string) ?? '平台管理员'}（Keycloak）`,
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
          account: 'platform.admin@example.com',
          password: 'demo123456',
          scope: LoginRequestScope.PLATFORM,
        },
      },
      {
        onSuccess: (res) => {
          const data = res.data;
          if (!data?.accessToken) return;
          signIn({
            token: data.accessToken,
            userId: data.userId ?? '',
            displayName: data.displayName ?? '平台管理员',
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
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-lg font-black text-white shadow-lg">
            24
          </div>
          <div>
            <p className="text-lg font-black text-slate-900">24Bid 平台运营后台</p>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Platform Admin</p>
          </div>
        </div>
        <Panel title="登录" icon={LogIn} subtitle="平台运营端 · 企业审核 / 租户 / 公告">
          <FeedbackNotice tone="info" message="生产登录走 Keycloak（OIDC 统一身份）。演示账号：平台管理员。" />
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
                <LogIn size={16} /> {login.isPending ? '登录中…' : '以平台管理员登录（自研 JWT）'}
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
