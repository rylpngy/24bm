// @24bid/api-client — orval 从后端 OpenAPI(springdoc)生成的 client + TanStack Query hooks。
// 正向契约：后端是唯一事实源。重新生成：pnpm --filter @24bid/api-client generate

export { configureApiClient, setAuthToken, setAuthExpiredHandler, setTokenRefresher, axiosInstance, downloadReport, uploadImportFile } from './http-client';
export type { ImportResult, ImportRowError } from './http-client';
export { replaceSupplierQualification, supplierQualificationHistory, buyerQualificationArchive } from './qualification-lifecycle';
export { qualificationReviews, decideQualificationReview } from './qualification-lifecycle';
export type { QualificationReview } from './qualification-lifecycle';
export type { ErrorType, BodyType } from './http-client';

// 竞价实时事件流(G-1):SSE 通道 + 订阅 hook(降级轮询由调用方按 live 控制)。
export { subscribeAuctionStream } from './auction-stream';
export type { AuctionStreamEvent, AuctionStreamHandlers } from './auction-stream';
export { useAuctionStream } from './use-auction-stream';

// 三端共用 QueryClient 工厂:统一默认项 + 修「变更后首次加载在途导致失效被去重」。
export { createAppQueryClient } from './query-client';

export * from './workflow-runtime';
export * from './performance-tasks';
export * from './supplier-team-roles';
export * from './supplier-exit-risk';
export * from './supplier-exit-items';
export type { SupplierExitItem, SupplierExitItemsPage } from './supplier-exit-items';
export * from './supplier-cooperation-invitations';
export * from './performance-evidence';
export * from './demand-queries';
export * from './payment-ledger';
export * from './payment-reviews';
export * from './attachment-integrity';
export * from './supplier-period-performance';
export * from './session-permissions';

export * from './generated/model';
export * from './generated/controllers';
