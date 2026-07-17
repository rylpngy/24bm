import { create } from 'zustand';
import { setAuthExpiredHandler, setAuthToken, setTokenRefresher } from '@24bid/api-client';
import { clearPersistedSession, loadPersistedSession, persistSession, refreshKeycloakToken } from '@24bid/shared';

interface SupplierSession {
  token: string;
  /** Keycloak 刷新令牌:存在时启用静默续签(自研 JWT 会话无此字段)。 */
  refreshToken?: string;
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

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8081';

// Keycloak 会话静默续签:access token(5 分钟)临期/401 时用 refresh token 换新,
// 轮换后的双 token 写回存储与状态,业务操作不再因 5 分钟过期而中断。
function installRefresher(hasRefreshToken: boolean) {
  setTokenRefresher(
    hasRefreshToken
      ? async () => {
          const current = useAuthStore.getState().session;
          if (!current?.refreshToken) return null;
          try {
            const next = await refreshKeycloakToken({
              keycloakUrl: KEYCLOAK_URL,
              refreshToken: current.refreshToken,
            });
            const session = { ...current, token: next.token, refreshToken: next.refreshToken };
            persistSession(STORAGE_KEY, session);
            useAuthStore.setState({ session });
            return next.token;
          } catch {
            return null;
          }
        }
      : null,
  );
}

// 启动时恢复未过期会话(按 JWT exp 校验),刷新不掉线。
const restoredSession = loadPersistedSession<SupplierSession>(STORAGE_KEY);
if (restoredSession) {
  setAuthToken(restoredSession.token);
  installRefresher(!!restoredSession.refreshToken);
}

// 供应商门户鉴权状态(Zustand);token 写入 api-client 拦截器。
// 会话彻底过期(401 且续签失败):清会话回登录门,避免整页请求持续报错。
setAuthExpiredHandler(() => {
  setAuthToken(null);
  setTokenRefresher(null);
  clearPersistedSession(STORAGE_KEY);
  useAuthStore.setState({ session: null });
});

export const useAuthStore = create<AuthState>((set) => ({
  session: restoredSession,
  signIn: (session) => {
    setAuthToken(session.token);
    installRefresher(!!session.refreshToken);
    persistSession(STORAGE_KEY, session);
    set({ session });
  },
  signOut: () => {
    setAuthToken(null);
    setTokenRefresher(null);
    clearPersistedSession(STORAGE_KEY);
    set({ session: null });
  },
}));
