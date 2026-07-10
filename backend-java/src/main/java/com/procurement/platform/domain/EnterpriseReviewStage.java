package com.procurement.platform.domain;

// 企业准入审核状态机的阶段(落在 supplier_enterprises.verified_status)。
public final class EnterpriseReviewStage {
  public static final String PENDING = "pending";        // 待初审
  public static final String PRELIMINARY = "preliminary"; // 初审通过(待复审)
  public static final String APPROVED = "approved";      // 准入通过
  public static final String REJECTED = "rejected";      // 已驳回

  private EnterpriseReviewStage() {}

  public static String label(String stage) {
    return switch (stage == null ? "" : stage) {
      case PENDING -> "待初审";
      case PRELIMINARY -> "初审通过";
      case APPROVED -> "准入通过";
      case REJECTED -> "已驳回";
      default -> stage;
    };
  }
}
