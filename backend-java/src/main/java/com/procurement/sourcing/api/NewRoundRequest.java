package com.procurement.sourcing.api;

import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;

// 再次报价:新一轮的报价截止时间;finalRound=true 表示最终轮(BAFO);note=谈判说明(竞争性谈判留痕)。
public record NewRoundRequest(@NotNull OffsetDateTime deadlineAt, boolean finalRound, String note) {
}
