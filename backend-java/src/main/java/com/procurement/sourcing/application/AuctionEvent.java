package com.procurement.sourcing.application;

import java.util.List;

/**
 * 竞价实时事件(G-1):**只发信号不发数据**——载荷仅含 rfqId 与事件类型,
 * 订阅端收到后用自己已授权的查询去取新值,推送通道本身不承载任何金额/排名信息,
 * 因此不引入越权面。收件人=RFQ 所属租户 + 受邀供应商。
 */
public record AuctionEvent(
    String tenantId,
    List<String> supplierIds,
    String rfqId,
    String kind) {

  /** 有效出价落库(新最低价/排名可能变化)。 */
  public static final String KIND_BID = "bid";

  /** 软关闭触发,竞价截止顺延。 */
  public static final String KIND_DEADLINE_EXTENDED = "deadline-extended";

  /** 竞价状态推进(开标/流标等)。 */
  public static final String KIND_STATUS = "status";
}
