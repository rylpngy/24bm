package com.procurement.sourcing.api;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.sourcing.application.AuctionStreamBroker;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 竞价实时事件流(G-1):采购方订阅本租户竞价、供应商订阅本方受邀竞价。
 * 事件仅含 rfqId 与类型,前端收到后用自己有权限的查询取数,故通道本身不承载业务数据。
 * 路径刻意不挂在 /buyer/rfqs 下,避免与 /buyer/rfqs/{rfqId} 的路径变量竞争。
 */
@RestController
public class AuctionStreamController {

  private final AuctionStreamBroker auctionStreamBroker;

  public AuctionStreamController(AuctionStreamBroker auctionStreamBroker) {
    this.auctionStreamBroker = auctionStreamBroker;
  }

  @GetMapping(value = "/api/v1/buyer/auction-stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public SseEmitter buyerStream() {
    return auctionStreamBroker.subscribeTenant(
        TenantAccessGuard.requireTenantId("buyer auction stream"));
  }

  @GetMapping(value = "/api/v1/supplier/auction-stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public SseEmitter supplierStream() {
    return auctionStreamBroker.subscribeSupplier(
        TenantAccessGuard.requireSupplierId("supplier auction stream"));
  }
}
