package com.procurement.finance.domain;

import java.math.BigDecimal;

// 差异分级审批:差异金额(绝对值)达到阈值时,买方核实不能直接结案,须经财务经理签核。
public final class VarianceApprovalPolicy {

  // 财务经理签核阈值(含):|差异金额| >= ¥10,000 触发分级审批。
  public static final BigDecimal MANAGER_APPROVAL_THRESHOLD = new BigDecimal("10000");

  public static final String STATUS_PENDING = "待处理";
  public static final String STATUS_MANAGER_REVIEW = "待财务经理签核";
  public static final String STATUS_RESOLVED = "已处理";

  private VarianceApprovalPolicy() {}

  public static boolean requiresManagerApproval(BigDecimal varianceAmount) {
    return varianceAmount != null
        && varianceAmount.abs().compareTo(MANAGER_APPROVAL_THRESHOLD) >= 0;
  }
}
