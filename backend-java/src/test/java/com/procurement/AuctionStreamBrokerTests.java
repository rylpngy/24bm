package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.sourcing.application.AuctionEvent;
import com.procurement.sourcing.application.AuctionStreamBroker;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** G-1 竞价事件通道:收件人分流(本租户 / 本方受邀)与订阅生命周期。 */
class AuctionStreamBrokerTests {

  private static final AuctionEvent EVENT = new AuctionEvent(
      "tenant-acme", List.of("sup-1", "sup-2"), "rfq-1", AuctionEvent.KIND_BID);

  @Test
  @DisplayName("采购方订阅只收本租户竞价事件")
  void tenantScoped() {
    assertThat(AuctionStreamBroker.recipientMatches("tenant-acme", null, EVENT)).isTrue();
    assertThat(AuctionStreamBroker.recipientMatches("tenant-other", null, EVENT)).isFalse();
    assertThat(AuctionStreamBroker.recipientMatches(null, null, EVENT)).isFalse();
  }

  @Test
  @DisplayName("供应商订阅只收本方受邀竞价事件,未受邀方收不到")
  void supplierScoped() {
    assertThat(AuctionStreamBroker.recipientMatches(null, "sup-1", EVENT)).isTrue();
    assertThat(AuctionStreamBroker.recipientMatches(null, "sup-9", EVENT)).isFalse();
    // 供应商身份优先:即便租户号撞上,也只按受邀名单判定。
    assertThat(AuctionStreamBroker.recipientMatches("tenant-acme", "sup-9", EVENT)).isFalse();
  }

  @Test
  @DisplayName("订阅注册后计入连接数,已结束的订阅在下一次投递时被清理")
  void closedSubscriptionsAreReaped() {
    AuctionStreamBroker broker = new AuctionStreamBroker();
    SseEmitter buyer = broker.subscribeTenant("tenant-acme", id -> true);
    broker.subscribeSupplier("sup-1");
    assertThat(broker.subscriptionCount()).isEqualTo(2);

    // 注:onCompletion 回调由 MVC 容器在异步请求收尾时触发,单测环境不会跑,
    // 因此这里验证的是「投递遇到已结束的订阅即清理」这条兜底路径。
    buyer.complete();
    broker.onEvent(EVENT);

    assertThat(broker.subscriptionCount()).isEqualTo(1);
  }

  @Test
  @DisplayName("向已断开的订阅投递不抛出,并清理该订阅")
  void dispatchToBrokenSubscriptionIsSafe() {
    AuctionStreamBroker broker = new AuctionStreamBroker();
    SseEmitter emitter = broker.subscribeTenant("tenant-acme", id -> true);
    emitter.completeWithError(new java.io.IOException("client gone"));

    broker.onEvent(EVENT);
    broker.heartbeat();

    assertThat(broker.subscriptionCount()).isZero();
  }

  @Test
  void unreadableRecordIsNotDeliveredEvenWithinTenant() {
    AuctionStreamBroker broker = new AuctionStreamBroker();
    SseEmitter denied = broker.subscribeTenant("tenant-acme", id -> false);
    denied.complete();
    broker.onEvent(EVENT);
    assertThat(broker.subscriptionCount()).isEqualTo(1);
  }
}
