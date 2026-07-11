import Axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

// orval 生成的 hooks 通过本 mutator 发请求：统一 baseURL、注入 JWT、返回响应体。
// 后端响应为 { data, error } 信封；类型由 ApiResponseXxx 表达，故此处返回整个信封。

export const axiosInstance = Axios.create({
  baseURL: 'http://localhost:8080',
});

let authToken: string | null = null;

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

axiosInstance.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.set('Authorization', `Bearer ${authToken}`);
  }
  return config;
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
