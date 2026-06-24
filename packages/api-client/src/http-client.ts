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

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;
