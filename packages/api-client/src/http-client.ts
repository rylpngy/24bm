import Axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

// orval 生成的 hooks 通过本 mutator 发请求：统一 baseURL、注入 JWT、返回响应体。
// 后端响应为 { data, error } 信封；类型由 ApiResponseXxx 表达，故此处返回整个信封。

export const axiosInstance = Axios.create({
  baseURL: 'http://localhost:8080',
});

let authToken: string | null = null;
let tokenRefresher: (() => Promise<string | null>) | null = null;
let authExpiredHandler: (() => void) | null = null;
let refreshing: Promise<string | null> | null = null;

/** 应用启动时配置后端地址。 */
export function configureApiClient(options: { baseUrl?: string }): void {
  if (options.baseUrl) {
    axiosInstance.defaults.baseURL = options.baseUrl;
  }
}

/** 登录后设置 JWT；登出传 null 清除。 */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * 安装令牌续签器(Keycloak refresh):请求前发现 access token 临期(<60s)即静默续签,
 * 401 响应再兜底续签一次并重放。续签器成功须自行更新存储并返回新 token;失败返回 null
 * (回落为原有「登录态过期」提示)。登出传 null 卸载。
 */
/** 会话彻底过期(401 且续签失败)时回调:通常清会话回登录门,避免页面持续报错。 */
export function setAuthExpiredHandler(handler: (() => void) | null): void {
  authExpiredHandler = handler;
}

export function setTokenRefresher(refresher: (() => Promise<string | null>) | null): void {
  tokenRefresher = refresher;
  refreshing = null;
}

function tokenExpiringSoon(token: string): boolean {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const exp = (JSON.parse(atob(part)) as { exp?: number }).exp;
    return typeof exp === 'number' && exp * 1000 - 60_000 <= Date.now();
  } catch {
    return false;
  }
}

// 单飞:并发请求共享同一次续签,避免 refresh token 轮换竞态。
async function refreshOnce(): Promise<string | null> {
  if (!tokenRefresher) return null;
  refreshing ??= tokenRefresher()
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  const next = await refreshing;
  if (next) authToken = next;
  return next;
}

axiosInstance.interceptors.request.use(async (config) => {
  if (authToken && tokenRefresher && tokenExpiringSoon(authToken)) {
    await refreshOnce();
  }
  if (authToken) {
    config.headers.set('Authorization', `Bearer ${authToken}`);
  }
  return config;
});

// 401 兜底:时钟偏差或续签窗口错过时,续签一次并重放原请求(仅一次,防循环)。
axiosInstance.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
  if (error.response?.status === 401 && config && !config._retried) {
    if (tokenRefresher) {
      const next = await refreshOnce();
      if (next) {
        config._retried = true;
        return axiosInstance(config);
      }
    }
    // 无续签器或续签失败:会话彻底过期,交回登录门。
    if (authToken && authExpiredHandler) {
      authExpiredHandler();
    }
  }
  return Promise.reject(error);
});

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  return axiosInstance({ ...config }).then(({ data }) => data);
};

/** 下载二进制报表(xlsx/pdf):复用注入 JWT 的 axios 实例,触发浏览器下载。 */
export async function downloadReport(path: string, fallbackName: string): Promise<void> {
  const res = await axiosInstance.get(path, { responseType: 'blob' });
  const disposition = (res.headers['content-disposition'] as string | undefined) ?? '';
  const match = /filename\*?=(?:UTF-8'')?["']?([^;"'\n]+)/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const url = URL.createObjectURL(res.data as Blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export interface ImportRowError {
  rowNumber: number;
  message: string;
}

export interface ImportResult {
  totalRows: number;
  successCount: number;
  failures: ImportRowError[];
}

/** Excel 导入:文件字节直传(application/octet-stream),返回部分成功结果。 */
export async function uploadImportFile(path: string, file: File): Promise<ImportResult> {
  const res = await axiosInstance.post(path, await file.arrayBuffer(), {
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  return (res.data as { data: ImportResult }).data;
}

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;
