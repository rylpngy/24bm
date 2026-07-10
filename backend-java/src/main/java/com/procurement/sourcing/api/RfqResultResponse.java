package com.procurement.sourcing.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

// 定标结果公示:中标人 + 中标通知书文本 + 本轮报价排名(中标/落标)。
public record RfqResultResponse(
    String rfqId,
    String title,
    String status,
    String method,
    String winnerSupplierId,
    BigDecimal winnerAmount,
    String awardReason,
    OffsetDateTime awardedAt,
    String notice,
    List<RfqResultRowResponse> rankings) {

  public record RfqResultRowResponse(
      int rank,
      String supplierId,
      BigDecimal amount,
      Integer deliveryDays,
      boolean awarded) {
  }
}
