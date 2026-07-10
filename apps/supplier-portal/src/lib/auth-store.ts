import { create } from 'zustand';
import { setAuthToken } from '@24bid/api-client';

interface SupplierSession {
  token: string;
  userId: string;
  displayName: string;
  supplierId: string;
}

interface AuthState {
  session: SupplierSession | null;
  signIn: (session: SupplierSession) => void;
  signOut: () => void;
}

// 供应商门户鉴权状态(Zustand);token 写入 api-client 拦截器。
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
