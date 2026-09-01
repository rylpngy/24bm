package com.procurement.ludongpoc.api;

import java.time.OffsetDateTime;
import java.util.Map;

public record LudongPocPriorApprovalEvidence(
    String nodeId,
    String reviewerId,
    String decision,
    Map<String, Object> reviewData,
    String comment,
    OffsetDateTime reviewedAt) {
}
