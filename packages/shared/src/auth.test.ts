import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { clearPersistedSession, decodeJwt, loadPersistedSession, persistSession } from './auth';

const KEY = 'test-session';

// jsdom 29 依赖 Node 内建 localStorage(需 --localstorage-file),测试环境装极简内存版。
beforeAll(() => {
  if (typeof globalThis.localStorage !== 'undefined') return;
  const backing = new Map<string, string>();
  const stub = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, String(v)),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
    key: (i: number) => [...backing.keys()][i] ?? null,
    get length() {
      return backing.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: stub, configurable: true });
});

function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}

afterEach(() => clearPersistedSession(KEY));

describe('decodeJwt', () => {
  it('decodes UTF-8 claims from a base64url payload', () => {
    const token = fakeJwt({ displayName: '采购负责人', tenantId: 'tenant-acme' });
    expect(decodeJwt(token)).toMatchObject({ displayName: '采购负责人', tenantId: 'tenant-acme' });
  });

  it('returns an empty object for malformed tokens', () => {
    expect(decodeJwt('not-a-jwt')).toEqual({});
  });
});

describe('session persistence', () => {
  it('round-trips an unexpired session', () => {
    const token = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const session: { token: string; userId: string } = { token, userId: 'u1' };
    persistSession(KEY, session);
    expect(loadPersistedSession<typeof session>(KEY)).toMatchObject({ token, userId: 'u1' });
  });

  it('drops an expired session and clears storage', () => {
    const token = fakeJwt({ exp: Math.floor(Date.now() / 1000) - 10 });
    persistSession(KEY, { token });
    expect(loadPersistedSession(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('drops sessions whose token has no exp claim', () => {
    persistSession(KEY, { token: fakeJwt({}) });
    expect(loadPersistedSession(KEY)).toBeNull();
  });

  it('drops corrupted payloads', () => {
    localStorage.setItem(KEY, '{broken json');
    expect(loadPersistedSession(KEY)).toBeNull();
  });
});
