package com.procurement.contract.api;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDate;

// 登记合同变更:changeType ∈ 金额变更/工期变更/条款变更/范围变更。
// 金额变更需 newAmount;工期变更需 newExpiryDate;均需 reason。
public record CreateContractAmendmentRequest(
    @NotBlank String changeType,
    BigDecimal newAmount,
    LocalDate newExpiryDate,
    @NotBlank String reason) {
}
