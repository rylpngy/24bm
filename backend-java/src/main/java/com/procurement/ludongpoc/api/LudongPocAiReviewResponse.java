package com.procurement.ludongpoc.api;

import java.time.OffsetDateTime;
import java.util.List;

public record LudongPocAiReviewResponse(
    String runId,
    String analysisMode,
    String modelName,
    String knowledgeVersion,
    String institutionalBasis,
    String evidenceBoundary,
    List<String> institutionalDocuments,
    OffsetDateTime generatedAt,
    String nodeName,
    String summary,
    String recommendation,
    int confidence,
    List<String> reviewFocus,
    List<LudongPocAiReviewFinding> findings,
    List<String> missingMaterials,
    String suggestedComment,
    String accuracyNotice) {
}
