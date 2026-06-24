import { create } from 'zustand';
import { setAuthToken } from '@24bid/api-client';

interface BuyerSession {
  token: string;
  userId: string;
  displayName: string;
  tenantId: string;
}

interface AuthState {
  session: BuyerSession | null;
  signIn: (session: BuyerSession) => void;
  signOut: () => void;
}

// 客户端鉴权状态(Zustand)。token 同时写入 api-client 的请求拦截器。
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  signIn: (session) => {
    setAuthToken(session.token);
    set({ session });
  },
  signOut: () => {
    setAuthToken(null);
    set({ session: null });
  },
}));
