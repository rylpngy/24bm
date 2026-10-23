package com.procurement.finance.api;

import java.math.BigDecimal;
import jakarta.validation.constraints.*;

public record RecordPaymentAmountRequest(
    @NotBlank @Size(max=100) String idempotencyKey,
    @NotNull @DecimalMin("0.01") @Digits(integer=12,fraction=2) BigDecimal amount,
    @Size(max=100) String milestoneId,
    @NotBlank @Size(max=200) String evidenceNo,
    @Size(max=1000) String remark) {}
