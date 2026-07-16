package com.procurement.tender.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * 投标递交视图。买方在开标(C-3)前只能看到递交登记(供应商/时间/密封状态/指纹),
 * bidAmount 与 documentHtml 置空;供应商可见本方完整内容与密封凭证。
 */
public record TenderBidResponse(
    String id,
    String tenderId,
    String supplierId,
    String supplierName,
    BigDecimal bidAmount,
    String documentHtml,
    String contentDigest,
    String sealedStatus,
    OffsetDateTime submittedAt,
    OffsetDateTime withdrawnAt) {
}
