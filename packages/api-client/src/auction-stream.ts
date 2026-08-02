import { axiosInstance } from './http-client';

/** 竞价实时事件(G-1):后端只推信号,数据仍由订阅方用自己有权限的查询获取。 */
export interface AuctionStreamEvent {
  rfqId: string;
  kind: 'bid' | 'deadline-extended' | 'status';
}

export interface AuctionStreamHandlers {
  /** 通道建立(收到首帧 ready):可据此关闭降级轮询。 */
  onOpen?: () => void;
  /** 通道断开(网络中断/会话失效/主动取消):须回落轮询。 */
  onClose?: () => void;
  onEvent: (event: AuctionStreamEvent) => void;
}

/**
 * 订阅竞价事件流。用 fetch + ReadableStream 而非 EventSource——EventSource 无法带
 * Authorization 头,把令牌塞进查询串会写进代理与浏览器历史,不可接受。
 *
 * 返回取消函数;连接中断不自动重连,由调用方(useAuctionStream)负责回落与重试。
 */
export function subscribeAuctionStream(
  scope: 'buyer' | 'supplier',
  token: string,
  handlers: AuctionStreamHandlers,
): () => void {
  const controller = new AbortController();
  const baseUrl = axiosInstance.defaults.baseURL ?? '';
  let closed = false;

  const finish = () => {
    if (closed) return;
    closed = true;
    handlers.onClose?.();
  };

  void (async () => {
    try {
      const response = await fetch(`${baseUrl}/api/v1/${scope}/auction-stream`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        finish();
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE 以空行分帧;心跳是注释帧(以 ':' 开头),解析后自然被忽略。
        let split = buffer.indexOf('\n\n');
        while (split >= 0) {
          const frame = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          const name = /^event:\s*(.+)$/m.exec(frame)?.[1]?.trim();
          const data = /^data:\s*(.+)$/m.exec(frame)?.[1]?.trim();
          if (name === 'ready') {
            handlers.onOpen?.();
          } else if (name === 'auction' && data) {
            try {
              handlers.onEvent(JSON.parse(data) as AuctionStreamEvent);
            } catch {
              // 帧损坏时忽略这一帧,通道继续。
            }
          }
          split = buffer.indexOf('\n\n');
        }
      }
    } catch {
      // abort 与网络错误都走同一收尾路径。
    } finally {
      finish();
    }
  })();

  return () => {
    controller.abort();
    finish();
  };
}
