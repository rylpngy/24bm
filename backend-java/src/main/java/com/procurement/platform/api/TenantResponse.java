package com.procurement.platform.api;

import java.util.List;

public record TenantResponse(
    String id,
    String name,
    String plan,
    String status,
    List<String> enabledFeatures,
    Integer userLimit) {
}
