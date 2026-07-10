import { create } from 'zustand';
import { setAuthToken } from '@24bid/api-client';
import { clearPersistedSession, loadPersistedSession, persistSession } from '@24bid/shared';

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

const STORAGE_KEY = '24bid.platform-admin.session';

// 启动时恢复未过期会话(按 JWT exp 校验),刷新不掉线。
const restoredSession = loadPersistedSession<PlatformSession>(STORAGE_KEY);
if (restoredSession) {
  setAuthToken(restoredSession.token);
}

// 平台运营后台鉴权状态(Zustand);token 写入 api-client 拦截器。
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
