import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LoginRequestScope, useAuthLogin } from '@24bid/api-client';
import { keycloakPasswordLogin } from '@24bid/shared';
import { useAuthStore } from '../../lib/auth-store';

export const SELF_LOGIN_FALLBACK = (import.meta.env.VITE_SELF_LOGIN ?? 'true') !== 'false';

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8081';

const walkthroughAccount=import.meta.env.VITE_WALKTHROUGH_ACCOUNT;
const localTenant=import.meta.env.VITE_SELF_LOGIN_TENANT_ID || "tenant-acme";
export const demoAccounts = walkthroughAccount ? [{account:walkthroughAccount,name:"走查管理员",hint:"本地合成数据走查"}] : [
  { account: 'buyer.owner@example.com', name: '采购管理员', hint: '全部权限' },
  { account: 'zhang.req@example.com', name: '采购申请员', hint: '需求/物料/询比' },
  { account: 'li.fin@example.com', name: '财务专员', hint: '付款/对账' },
];

export function useBuyerLogin() {
  const signIn = useAuthStore((s) => s.signIn);
  const queryClient = useQueryClient();
  const login = useAuthLogin();
  const [kcBusy, setKcBusy] = useState(false);
  const [kcError, setKcError] = useState(false);

  const handleKeycloakLogin = async (
    username = 'buyer.owner@example.com',
    password = 'demo123456',
  ) => {
    setKcBusy(true);
    setKcError(false);
    try {
      const { token, claims, refreshToken } = await keycloakPasswordLogin({
        keycloakUrl: KEYCLOAK_URL,
        username,
        password,
      });
      signIn({
        token,
        refreshToken,
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

  const handleLogin = (account = 'buyer.owner@example.com', fallbackName = '采购负责人') => {
    login.mutate(
      {
        data: {
          account,
          password: 'demo123456',
          scope: LoginRequestScope.BUYER,
          tenantId: localTenant,
        },
      },
      {
        onSuccess: (res) => {
          const data = res.data;
          if (!data?.accessToken || !data.tenantId) return;
          signIn({
            token: data.accessToken,
            userId: data.userId ?? '',
            displayName: data.displayName ?? fallbackName,
            tenantId: data.tenantId,
          });
          queryClient.clear();
        },
      },
    );
  };

  return {
    demoAccounts,
    handleKeycloakLogin,
    handleLogin,
    kcBusy,
    kcError,
    login,
  };
}
