package com.procurement.ludongpoc.api;

public record LudongPocAiEvidenceReference(
    String id,
    String type,
    String label,
    String value,
    String source,
    String verificationStatus) {
}
