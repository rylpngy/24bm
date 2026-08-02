package com.procurement.sourcing.application;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 竞价事件推送通道(G-1):替代前端 5 秒轮询。
 *
 * <p>订阅按身份分流——采购方订阅本租户全部竞价,供应商订阅本方受邀竞价;
 * 事件在**事务提交后**才投递,否则订阅端会赶在提交前回查到旧值。
 * 单实例内存注册表:多实例部署时各实例只推送自身产生的事件,
 * 前端保留降级轮询兜底,故不影响正确性。
 */
@Component
public class AuctionStreamBroker {

  /** 订阅存活上限;超时后浏览器侧自动重连。 */
  private static final long TIMEOUT_MILLIS = 30 * 60 * 1000L;

  private final Map<String, Subscription> subscriptions = new ConcurrentHashMap<>();

  private record Subscription(SseEmitter emitter, String tenantId, String supplierId) {
    boolean accepts(AuctionEvent event) {
      return recipientMatches(tenantId, supplierId, event);
    }
  }

  /**
   * 收件人判定:供应商订阅只收本方受邀的竞价,采购方订阅只收本租户的竞价。
   * 抽为纯函数以便直接单测——这是本通道唯一的越权面。
   */
  public static boolean recipientMatches(String tenantId, String supplierId, AuctionEvent event) {
    if (supplierId != null) {
      return event.supplierIds().contains(supplierId);
    }
    return tenantId != null && tenantId.equals(event.tenantId());
  }

  /** 采购方订阅:本租户竞价事件。 */
  public SseEmitter subscribeTenant(String tenantId) {
    return register(new Subscription(new SseEmitter(TIMEOUT_MILLIS), tenantId, null));
  }

  /** 供应商订阅:本方受邀竞价事件。 */
  public SseEmitter subscribeSupplier(String supplierId) {
    return register(new Subscription(new SseEmitter(TIMEOUT_MILLIS), null, supplierId));
  }

  private SseEmitter register(Subscription subscription) {
    String id = UUID.randomUUID().toString();
    subscriptions.put(id, subscription);
    subscription.emitter().onCompletion(() -> subscriptions.remove(id));
    subscription.emitter().onTimeout(() -> subscriptions.remove(id));
    subscription.emitter().onError(e -> subscriptions.remove(id));
    try {
      // 首帧:让前端立即确认通道已建立(据此关闭降级轮询)。
      subscription.emitter().send(SseEmitter.event().name("ready").data("{}"));
    } catch (IOException e) {
      subscriptions.remove(id);
      subscription.emitter().completeWithError(e);
    }
    return subscription.emitter();
  }

  /** 事务提交后投递;未处于事务中的调用由下面的 {@link #onEventOutsideTransaction} 兜底。 */
  @TransactionalEventListener
  public void onEvent(AuctionEvent event) {
    dispatch(event);
  }

  @EventListener
  public void onEventOutsideTransaction(AuctionEvent event) {
    if (!org.springframework.transaction.support.TransactionSynchronizationManager
        .isActualTransactionActive()) {
      dispatch(event);
    }
  }

  private void dispatch(AuctionEvent event) {
    subscriptions.forEach((id, subscription) -> {
      if (!subscription.accepts(event)) {
        return;
      }
      try {
        subscription.emitter().send(SseEmitter.event()
            .name("auction")
            .data("{\"rfqId\":\"" + event.rfqId() + "\",\"kind\":\"" + event.kind() + "\"}"));
      } catch (IOException | IllegalStateException e) {
        subscriptions.remove(id);
      }
    });
  }

  /** 心跳:穿过反向代理的空闲超时,同时清理已断开的订阅。 */
  @Scheduled(fixedDelay = 20_000L)
  public void heartbeat() {
    subscriptions.forEach((id, subscription) -> {
      try {
        subscription.emitter().send(SseEmitter.event().comment("keep-alive"));
      } catch (IOException | IllegalStateException e) {
        subscriptions.remove(id);
      }
    });
  }

  /** 当前订阅数(测试与运维观测用)。 */
  public int subscriptionCount() {
    return subscriptions.size();
  }
}
