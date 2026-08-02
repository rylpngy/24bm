import { useEffect, useState } from 'react';
import { subscribeAuctionStream, type AuctionStreamEvent } from './auction-stream';

/**
 * 竞价实时订阅(G-1):通道畅通时由服务端推送驱动刷新,断线则回落轮询。
 *
 * 返回 `live`——通道是否畅通。调用方据此设置 refetchInterval:
 * `live ? false : 5_000`,即推送可用就不轮询;不可用(代理断流、多实例部署
 * 事件产生在别的实例)时行为与改造前完全一致,不会漏数据。
 */
export function useAuctionStream(options: {
  scope: 'buyer' | 'supplier';
  token: string | null | undefined;
  /** 无进行中竞价时不必占用连接。 */
  enabled: boolean;
  /** 须用 useCallback 稳定,否则每次渲染都会重建连接。 */
  onEvent: (event: AuctionStreamEvent) => void;
}): { live: boolean } {
  const { scope, token, enabled, onEvent } = options;
  const [live, setLive] = useState(false);
  // 断流后按次数递增退避重连;每次自增以重跑 effect。
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !token) {
      setLive(false);
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const cancel = subscribeAuctionStream(scope, token, {
      onOpen: () => setLive(true),
      onClose: () => {
        setLive(false);
        // 退避重连:1s 起,封顶 30s;期间由降级轮询保证数据新鲜。
        retryTimer = setTimeout(
          () => setAttempt((n) => n + 1),
          Math.min(30_000, 1_000 * 2 ** attempt),
        );
      },
      onEvent,
    });
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      cancel();
    };
  }, [scope, token, enabled, attempt, onEvent]);

  return { live };
}
