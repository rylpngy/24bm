package com.procurement.ludongpoc.api;

import java.util.List;

public record LudongPocAiReviewFinding(
    String findingId,
    String level,
    String title,
    String detail,
    String evidence,
    List<LudongPocAiEvidenceReference> evidenceReferences) {
}
