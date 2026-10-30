package com.procurement.finance.api;

import java.math.BigDecimal;
import jakarta.validation.constraints.*;

public record RecordPaymentAmountRequest(
    @NotBlank @Size(max=100) String idempotencyKey,
    @NotNull @DecimalMin("0.01") @Digits(integer=12,fraction=2) BigDecimal amount,
    @Size(max=100) String milestoneId,
    @NotBlank @Size(max=200) String evidenceNo,
    @Size(max=1000) String remark,
    @Size(max=30) java.util.List<@jakarta.validation.Valid FundingLine> fundingLines) {
  public RecordPaymentAmountRequest(String key,java.math.BigDecimal amount,String milestone,String evidence,String remark){this(key,amount,milestone,evidence,remark,null);}
  @io.swagger.v3.oas.annotations.media.Schema(name="PaymentFundingLine")
  public record FundingLine(@NotBlank String fundId,@NotNull @DecimalMin("0.01") @Digits(integer=14,fraction=2)BigDecimal amount) {}
}
