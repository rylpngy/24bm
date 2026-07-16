package com.procurement.tender.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

// 投标递交:报价 + 投标函正文(附件走 attachments)。递交即密封,开标前对招标人不可见。
public record SubmitTenderBidRequest(
    @NotNull(message = "投标报价不能为空") @Positive(message = "投标报价须为正数") BigDecimal bidAmount,
    @NotBlank(message = "投标函正文不能为空") String documentHtml) {
}
