import { LogIn } from 'lucide-react';
import { LoginRequestScope, useAuthLogin } from '@24bid/api-client';
import { FeedbackNotice, Panel, PrimaryActionButton } from '@24bid/ui';
import { useAuthStore } from '../lib/auth-store';

// 平台运营登录门(现有 JWT,PLATFORM scope)。演示固定平台管理员账号。
export function LoginGate() {
  const signIn = useAuthStore((s) => s.signIn);
  const login = useAuthLogin();

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
          <FeedbackNotice tone="info" message="演示账号：平台管理员。点击登录进入运营后台。" />
          <PrimaryActionButton onClick={handleLogin} busy={login.isPending} pendingLabel="登录中" icon={LogIn} fullWidth>
            以平台管理员登录
          </PrimaryActionButton>
          {login.isError && (
            <div className="mt-3">
              <FeedbackNotice tone="error" message="登录失败：请确认后端已在 8080 运行。" />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
