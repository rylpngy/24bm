import { LogIn } from 'lucide-react';
import { LoginRequestScope, useAuthLogin } from '@24bid/api-client';
import { FeedbackNotice, Panel, PrimaryActionButton } from '@24bid/ui';
import { useAuthStore } from '../lib/auth-store';

// 供应商登录门(现有 JWT,SUPPLIER scope)。演示固定供应商销售账号。
export function LoginGate() {
  const signIn = useAuthStore((s) => s.signIn);
  const login = useAuthLogin();

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
        </Panel>
      </div>
    </div>
  );
}
