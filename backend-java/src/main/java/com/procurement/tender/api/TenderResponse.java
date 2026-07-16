package com.procurement.tender.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record TenderResponse(
    String id,
    String tenantId,
    String tenderNo,
    String title,
    String tenderType,
    BigDecimal budget,
    String status,
    // 招标文件正文:供应商侧领取(或受邀发放)前不下发。
    String documentHtml,
    String evaluationMethod,
    BigDecimal bidBondAmount,
    OffsetDateTime acquisitionDeadline,
    OffsetDateTime submissionDeadline,
    OffsetDateTime openingAt,
    OffsetDateTime publishedAt,
    OffsetDateTime createdAt,
    // 领取记录:买方视角全量;供应商视角仅本方一条。
    List<TenderAcquisitionResponse> acquisitions,
    // 投标递交:买方开标前仅递交登记(内容封存);供应商仅本方完整视图。
    List<TenderBidResponse> bids) {
}
