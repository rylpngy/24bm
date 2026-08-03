import { QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from './query-client';

const KEY = ['/api/v1/buyer/tenders'] as const;

/** 手动可控的 promise:模拟一次「迟迟不返回」的首次加载。 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('createAppQueryClient', () => {
  it('首次加载在途时失效,会重新发起请求而不是复用旧的在途请求', async () => {
    const client = createAppQueryClient();
    const first = deferred<string[]>();
    const queryFn = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => Promise.resolve(['旧数据', '新建的招标']));

    // 挂一个观察者模拟页面上的 useQuery:失效只会重取「活跃」查询。
    const observer = new QueryObserver(client, { queryKey: KEY, queryFn });
    const unsubscribe = observer.subscribe(() => {});
    // 首次加载发起后不 resolve:此刻 status=pending、dataUpdatedAt=0。
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    // 变更完成后的失效:必须重新取数,否则拿回的是「早于本次变更」的响应。
    await client.invalidateQueries({ queryKey: KEY });
    first.resolve(['旧数据']);

    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    await vi.waitFor(() =>
      expect(client.getQueryData(KEY)).toEqual(['旧数据', '新建的招标']),
    );
    unsubscribe();
  });

  it('已有数据的查询照常失效重取(不改变原有行为)', async () => {
    const client = createAppQueryClient();
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce(['第一版'])
      .mockResolvedValueOnce(['第二版']);

    const observer = new QueryObserver(client, { queryKey: KEY, queryFn });
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(client.getQueryData(KEY)).toEqual(['第一版']));

    await client.invalidateQueries({ queryKey: KEY });
    await vi.waitFor(() => expect(client.getQueryData(KEY)).toEqual(['第二版']));
    expect(queryFn).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('沿用三端统一默认项,且可被调用方覆盖', () => {
    const client = createAppQueryClient();
    expect(client.getDefaultOptions().queries?.staleTime).toBe(0);
    expect(client.getDefaultOptions().queries?.refetchOnMount).toBe('always');

    const custom = createAppQueryClient({ defaultOptions: { queries: { retry: 5 } } });
    expect(custom.getDefaultOptions().queries?.retry).toBe(5);
    expect(custom.getDefaultOptions().queries?.staleTime).toBe(0);
  });
});
