import { create } from 'zustand';
import { setAuthToken } from '@24bid/api-client';
import { clearPersistedSession, loadPersistedSession, persistSession } from '@24bid/shared';

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

const STORAGE_KEY = '24bid.supplier-portal.session';

// 启动时恢复未过期会话(按 JWT exp 校验),刷新不掉线。
const restoredSession = loadPersistedSession<SupplierSession>(STORAGE_KEY);
if (restoredSession) {
  setAuthToken(restoredSession.token);
}

// 供应商门户鉴权状态(Zustand);token 写入 api-client 拦截器。
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
