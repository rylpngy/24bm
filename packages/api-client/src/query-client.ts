import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';

/**
 * 三端共用的 QueryClient 工厂。
 *
 * 除统一默认项外,这里修掉一个**变更后列表不刷新**的真实缺陷:
 *
 * 变更成功的回调里通常是 `invalidateQueries` 拉新数据。若此刻列表查询的
 * **首次加载**还在途(status=pending / dataUpdatedAt=0),TanStack Query v5 的
 * `Query.fetch` 只有在 `dataUpdatedAt` 非 0 时才会理会 `cancelRefetch`,
 * 否则直接复用在途 promise:
 *
 *   if (this.state.fetchStatus !== 'idle') {
 *     if (this.state.dataUpdatedAt && fetchOptions?.cancelRefetch) { cancel() }
 *     else if (retryer) { return retryer.promise }   // ← 首次加载走这里
 *   }
 *
 * 于是失效被合并到一个**早于本次变更发出**的请求上:落库的新数据不在响应里,
 * 之后也不会再发请求,列表就一直是旧的。数据量越大、首次加载越慢,窗口越宽——
 * 空库几乎撞不上,存量库上「新建后台账里找不到」就会偶发。
 *
 * 修法:失效前先取消「尚未拿到过数据且仍在途」的匹配查询,让它重新发起。
 * 已有数据的查询不受影响(v5 本来就会 cancel + 重取),因此没有额外的闪烁。
 */
export function createAppQueryClient(config?: QueryClientConfig): QueryClient {
  const client = new QueryClient({
    ...config,
    defaultOptions: {
      ...config?.defaultOptions,
      queries: {
        refetchOnMount: 'always',
        retry: 1,
        staleTime: 0,
        ...config?.defaultOptions?.queries,
      },
    },
  });

  const invalidate = client.invalidateQueries.bind(client);
  client.invalidateQueries = ((filters?: Parameters<QueryClient['invalidateQueries']>[0],
    options?: Parameters<QueryClient['invalidateQueries']>[1]) => {
    for (const query of client.getQueryCache().findAll(filters)) {
      if (query.state.dataUpdatedAt === 0 && query.state.fetchStatus === 'fetching') {
        void query.cancel({ silent: true });
      }
    }
    return invalidate(filters, options);
  }) as QueryClient['invalidateQueries'];

  return client;
}
