import { KeyRound, LogIn } from 'lucide-react';
import { FeedbackNotice, Panel, PrimaryActionButton } from '@24bid/ui';
import { SELF_LOGIN_FALLBACK, useBuyerLogin } from './auth/use-buyer-login';

// 自研 JWT 已退役为 CI/开发后备;生产登录走 Keycloak(OIDC)。
// S1：采购方登录门。自研 JWT(/auth/login)与 Keycloak(OIDC direct-grant)双路径。
export function LoginGate() {
  const { demoAccounts, handleKeycloakLogin, handleLogin, kcBusy, kcError, login } = useBuyerLogin();

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
          <FeedbackNotice tone="info" message="生产登录走 Keycloak（OIDC 统一身份）。演示账号：采购负责人。" />
          <PrimaryActionButton
            onClick={handleKeycloakLogin}
            busy={kcBusy}
            pendingLabel="登录中"
            icon={KeyRound}
            fullWidth
          >
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
                自研 JWT（已退役 · 仅 CI/开发后备）· 演示角色
              </p>
              <div className="space-y-2">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.account}
                    type="button"
                    onClick={() => handleLogin(acc.account, acc.name)}
                    disabled={login.isPending}
                    className="flex h-10 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <LogIn size={16} className="shrink-0 text-slate-400" />
                    <span>{login.isPending ? '登录中…' : `以${acc.name}登录`}</span>
                    <span className="ml-auto text-[11px] font-bold text-slate-400">{acc.hint}</span>
                  </button>
                ))}
              </div>
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
