package com.procurement.tender.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

// 招标项目编制(新建与编辑共用):正文与时间节点可在编制期分次补齐,发布时统一校验。
public record SaveTenderRequest(
    @NotBlank(message = "招标项目名称不能为空") String title,
    @NotBlank(message = "招标方式不能为空(公开招标/邀请招标)") String tenderType,
    @Positive(message = "预算金额须大于 0") BigDecimal budget,
    String documentHtml,
    String evaluationMethod,
    BigDecimal bidBondAmount,
    OffsetDateTime acquisitionDeadline,
    OffsetDateTime submissionDeadline,
    OffsetDateTime openingAt) {
}
