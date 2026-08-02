// @24bid/api-client — orval 从后端 OpenAPI(springdoc)生成的 client + TanStack Query hooks。
// 正向契约：后端是唯一事实源。重新生成：pnpm --filter @24bid/api-client generate

export { configureApiClient, setAuthToken, setAuthExpiredHandler, setTokenRefresher, axiosInstance, downloadReport, uploadImportFile } from './http-client';
export type { ImportResult, ImportRowError } from './http-client';
export type { ErrorType, BodyType } from './http-client';

// 竞价实时事件流(G-1):SSE 通道 + 订阅 hook(降级轮询由调用方按 live 控制)。
export { subscribeAuctionStream } from './auction-stream';
export type { AuctionStreamEvent, AuctionStreamHandlers } from './auction-stream';
export { useAuctionStream } from './use-auction-stream';

export * from './generated/model';
export * from './generated/controllers';
