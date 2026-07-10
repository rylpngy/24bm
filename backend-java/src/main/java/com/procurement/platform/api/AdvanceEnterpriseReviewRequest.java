package com.procurement.platform.api;

import jakarta.validation.constraints.NotBlank;

// 推进企业准入审核一步:action ∈ preliminary_pass/approve/reject/return/reopen。
// reject 与 return 必须填写 comment(理由)。approve 时可附带资料/风险确认。
public record AdvanceEnterpriseReviewRequest(
    @NotBlank String action,
    String comment,
    Boolean profileConfirmed,
    Boolean riskConfirmed) {
}
