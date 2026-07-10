package com.procurement.contract.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

// 合同变更/补充协议一条:对合同金额/工期/条款/范围的一次变更留痕。
public record ContractAmendment(
    String id,
    String tenantId,
    String contractId,
    int seq,
    String changeType,
    BigDecimal oldAmount,
    BigDecimal newAmount,
    LocalDate oldExpiryDate,
    LocalDate newExpiryDate,
    String reason,
    String actorId,
    OffsetDateTime createdAt) {

  public static final String AMOUNT = "金额变更";
  public static final String SCHEDULE = "工期变更";
  public static final String TERMS = "条款变更";
  public static final String SCOPE = "范围变更";

  public static boolean isValidType(String type) {
    return AMOUNT.equals(type) || SCHEDULE.equals(type) || TERMS.equals(type) || SCOPE.equals(type);
  }
}
