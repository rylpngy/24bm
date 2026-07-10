import { create } from 'zustand';
import { setAuthToken } from '@24bid/api-client';
import { clearPersistedSession, loadPersistedSession, persistSession } from '@24bid/shared';

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

const STORAGE_KEY = '24bid.tenant-portal.session';

// 启动时恢复未过期会话(按 JWT exp 校验),刷新不掉线。
const restoredSession = loadPersistedSession<BuyerSession>(STORAGE_KEY);
if (restoredSession) {
  setAuthToken(restoredSession.token);
}

// 客户端鉴权状态(Zustand)。token 同时写入 api-client 的请求拦截器。
export const useAuthStore = create<AuthState>((set) => ({
  session: restoredSession,
  signIn: (session) => {
    setAuthToken(session.token);
    persistSession(STORAGE_KEY, session);
    set({ session });
  },
  signOut: () => {
    setAuthToken(null);
    clearPersistedSession(STORAGE_KEY);
    set({ session: null });
  },
}));
