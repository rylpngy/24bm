package com.procurement.process.api;

import java.time.OffsetDateTime;

public record ProcessDefinitionResponse(
    String id,
    String name,
    String description,
    String icon,
    String status,
    String formSchema,
    String flowSchema,
    OffsetDateTime updatedAt) {
}
