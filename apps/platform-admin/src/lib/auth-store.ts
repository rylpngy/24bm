import { create } from 'zustand';
import { setAuthToken } from '@24bid/api-client';

interface PlatformSession {
  token: string;
  userId: string;
  displayName: string;
}

interface AuthState {
  session: PlatformSession | null;
  signIn: (session: PlatformSession) => void;
  signOut: () => void;
}

// 平台运营后台鉴权状态(Zustand);token 写入 api-client 拦截器。
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
