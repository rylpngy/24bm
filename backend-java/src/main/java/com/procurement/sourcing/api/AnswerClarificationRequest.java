package com.procurement.sourcing.api;

import jakarta.validation.constraints.NotBlank;

// published=true 表示答复广播给该 RFQ 全部受邀供应商;false 仅提问方可见。
public record AnswerClarificationRequest(@NotBlank String answer, boolean published) {
}
