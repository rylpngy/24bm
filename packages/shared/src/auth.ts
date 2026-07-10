// 共享登录/会话工具:三端登录门共用,消除各端内联的 decodeJwt / Keycloak 密码登录 / 会话持久化拷贝。

/** 解码 JWT payload(base64url + UTF-8);解码失败返回空对象。 */
export function decodeJwt(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(part);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {};
  }
}

export interface KeycloakLoginResult {
  token: string;
  claims: Record<string, unknown>;
}

/** Keycloak 密码模式登录(演示/开发用直连 token 端点),返回 access token 与解码后的 claims。 */
export async function keycloakPasswordLogin(options: {
  keycloakUrl: string;
  username: string;
  password: string;
  realm?: string;
  clientId?: string;
}): Promise<KeycloakLoginResult> {
  const realm = options.realm ?? '24bid';
  const clientId = options.clientId ?? '24bid-portal';
  const res = await fetch(`${options.keycloakUrl}/realms/${realm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      username: options.username,
      password: options.password,
    }),
  });
  if (!res.ok) {
    throw new Error(`Keycloak login failed: ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string };
  return { token: data.access_token, claims: decodeJwt(data.access_token) };
}

// 会话持久化:localStorage 存储,恢复时校验 JWT exp(留 30s 余量),过期即清除。
const EXP_MARGIN_MS = 30_000;

interface PersistedSession {
  token: string;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function persistSession(storageKey: string, session: PersistedSession): void {
  storage()?.setItem(storageKey, JSON.stringify(session));
}

export function clearPersistedSession(storageKey: string): void {
  storage()?.removeItem(storageKey);
}

/** 恢复持久化会话;缺失、损坏或 token 已过期(按 exp claim)时返回 null 并清除存储。 */
export function loadPersistedSession<T extends PersistedSession>(storageKey: string): T | null {
  const store = storage();
  const raw = store?.getItem(storageKey);
  if (!store || !raw) return null;
  try {
    const session = JSON.parse(raw) as T;
    if (typeof session?.token !== 'string' || !session.token) throw new Error('bad session');
    const exp = decodeJwt(session.token).exp;
    if (typeof exp !== 'number' || exp * 1000 - EXP_MARGIN_MS <= Date.now()) {
      store.removeItem(storageKey);
      return null;
    }
    return session;
  } catch {
    store.removeItem(storageKey);
    return null;
  }
}
