import { LogIn } from 'lucide-react';
import { LoginRequestScope, useAuthLogin } from '@24bid/api-client';
import { FeedbackNotice, Panel, PrimaryActionButton } from '@24bid/ui';
import { useAuthStore } from '../lib/auth-store';

// S1：采购方登录门(现有 JWT)。演示固定采购负责人账号；后续切片接入 Keycloak。
export function LoginGate() {
  const signIn = useAuthStore((s) => s.signIn);
  const login = useAuthLogin();

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
        </Panel>
      </div>
    </div>
  );
}
